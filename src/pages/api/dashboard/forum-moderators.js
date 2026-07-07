/**
 * GET  /api/dashboard/forum-moderators?staff=1
 *   List users with forum_role moderator or admin.
 *
 * PATCH /api/dashboard/forum-moderators
 *   Body: { user_id, forum_role?, moderator_topics?: string[] }
 *   - Set role (member | moderator | admin)
 *   - Optionally set moderator_topics when role is moderator (or topics-only update)
 *
 * Station dashboard only (x-dashboard-key).
 */

import { checkDashboardAuth } from '../../../lib/dashboard-auth.js';
import { getAdminClient } from '../../../lib/server-auth.js';
import { FORUM_ROLES } from '../../../lib/forum-roles.js';
import { logForumModeration } from '../../../lib/forum-moderation.js';
import {
  getModeratorTopicsMap,
  setModeratorTopics,
  clearModeratorTopics,
  normalizeModeratorTopics,
} from '../../../lib/forum-moderator-assignments.js';

async function enrichWithEmail(admin, profiles) {
  if (!profiles?.length) return [];
  return Promise.all(
    profiles.map(async (profile) => {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(profile.id);
        return { ...profile, email: user?.email || null };
      } catch {
        return { ...profile, email: null };
      }
    }),
  );
}

async function resolveDashboardActorId(admin) {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('forum_role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export default async function handler(req, res) {
  if (!checkDashboardAuth(req, res)) return;

  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'PATCH') return handlePatch(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  if (req.query.staff !== '1') {
    return res.status(400).json({ error: 'Use ?staff=1 to list forum staff.' });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name, forum_role, status, subscription_tier, created_at, updated_at')
    .in('forum_role', ['moderator', 'admin'])
    .order('forum_role', { ascending: false })
    .order('display_name', { ascending: true });

  if (error) {
    if (error.message?.includes('forum_role')) {
      return res.status(503).json({ error: 'forum_role 欄位尚未建立，請先執行 migration。' });
    }
    return res.status(500).json({ error: 'Database error' });
  }

  const profiles = data || [];
  const modIds = profiles.filter((p) => p.forum_role === 'moderator').map((p) => p.id);
  let topicsMap = new Map();
  try {
    topicsMap = await getModeratorTopicsMap(admin, modIds);
  } catch (mapErr) {
    console.error('[forum-moderators] topics map failed:', mapErr.message);
  }

  const staff = await enrichWithEmail(admin, profiles.map((p) => ({
    ...p,
    moderator_topics: p.forum_role === 'admin'
      ? ['全部']
      : (topicsMap.get(p.id) || []),
  })));

  return res.status(200).json({ staff, total: staff.length });
}

async function handlePatch(req, res) {
  const body = req.body || {};
  const { user_id: userId, forum_role: forumRole, moderator_topics: moderatorTopics } = body;

  if (!userId) {
    return res.status(400).json({ error: 'user_id required' });
  }
  if (!forumRole && moderatorTopics === undefined) {
    return res.status(400).json({ error: 'forum_role or moderator_topics required' });
  }
  if (forumRole && !FORUM_ROLES.includes(forumRole)) {
    return res.status(400).json({ error: 'Invalid forum_role' });
  }

  const admin = getAdminClient();
  const { data: before, error: readErr } = await admin
    .from('profiles')
    .select('id, display_name, forum_role, status')
    .eq('id', userId)
    .maybeSingle();

  if (readErr) return res.status(500).json({ error: 'Database error' });
  if (!before) return res.status(404).json({ error: 'User not found' });

  const actorId = await resolveDashboardActorId(admin);
  const previousRole = before.forum_role || 'member';
  const effectiveRole = forumRole || previousRole;

  if (forumRole && forumRole !== previousRole) {
    if (previousRole === 'admin' && forumRole !== 'admin') {
      const { count, error: countErr } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('forum_role', 'admin')
        .eq('status', 'active');
      if (countErr) return res.status(500).json({ error: 'Database error' });
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: '至少需要保留一位管理員。' });
      }
    }

    const { error: updateErr } = await admin
      .from('profiles')
      .update({ forum_role: forumRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateErr) {
      if (updateErr.message?.includes('forum_role')) {
        return res.status(503).json({ error: 'forum_role 欄位尚未建立，請先執行 migration。' });
      }
      return res.status(500).json({ error: 'Update failed' });
    }

    await logForumModeration({
      actorId,
      action: 'set_forum_role',
      targetType: 'profile',
      targetId: userId,
      payload: {
        display_name: before.display_name,
        before: previousRole,
        after: forumRole,
        via_dashboard: true,
      },
    });

    if (forumRole === 'member') {
      await clearModeratorTopics(admin, userId);
    } else if (forumRole === 'moderator' && moderatorTopics === undefined) {
      await setModeratorTopics(admin, userId, ['全部'], { assignedBy: actorId });
    }
  }

  if (effectiveRole === 'moderator' && moderatorTopics !== undefined) {
    const topicsResult = await setModeratorTopics(admin, userId, moderatorTopics, {
      assignedBy: actorId,
    });
    if (!topicsResult.ok) {
      return res.status(topicsResult.status).json({ error: topicsResult.error });
    }

    await logForumModeration({
      actorId,
      action: 'set_moderator_topics',
      targetType: 'profile',
      targetId: userId,
      payload: {
        display_name: before.display_name,
        topics: topicsResult.topics,
        via_dashboard: true,
      },
    });

    return res.status(200).json({
      success: true,
      forum_role: effectiveRole,
      moderator_topics: topicsResult.topics,
    });
  }

  if (forumRole && forumRole !== previousRole) {
    const savedTopics = effectiveRole === 'moderator'
      ? normalizeModeratorTopics(
        moderatorTopics !== undefined ? moderatorTopics : ['全部'],
      )
      : [];

    return res.status(200).json({
      success: true,
      forum_role: forumRole,
      previous_role: previousRole,
      moderator_topics: savedTopics,
    });
  }

  return res.status(200).json({ success: true, unchanged: true });
}
