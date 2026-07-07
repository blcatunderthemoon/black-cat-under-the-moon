/**
 * Topic-scoped moderator assignments (forum_moderator_assignments).
 */

import { displayTopic, FORUM_TOPICS } from './forum-categories.js';
import { canAdminForum, canModerateForum } from './forum-roles.js';

/** Assignable scopes: 全部 (all boards) or individual post topics. */
export const MODERATOR_ASSIGNABLE_TOPICS = FORUM_TOPICS;

function isMissingAssignmentsTable(error) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = String(error.message || '');
  return msg.includes('forum_moderator_assignments')
    && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('Could not find'));
}

function assignmentsTableError(error, fallbackZh) {
  if (isMissingAssignmentsTable(error)) {
    return {
      ok: false,
      status: 503,
      error: 'forum_moderator_assignments 尚未建立。請在 Supabase SQL Editor 執行 supabase/migrations/20250707000000_forum_moderator_assignments.sql（或 20250712000000_forum_moderation.sql）。',
    };
  }
  console.error('[forum-moderator-assignments]', error?.code, error?.message || error);
  return { ok: false, status: 500, error: fallbackZh || '版塊指派失敗，請稍後再試。' };
}

function topicInFilter(topics) {
  const quoted = topics.map((t) => `"${String(t).replace(/"/g, '')}"`);
  return `(${quoted.join(',')})`;
}

export function normalizeModeratorTopics(topics) {
  const valid = new Set(MODERATOR_ASSIGNABLE_TOPICS);
  const cleaned = [...new Set((topics || []).filter((t) => valid.has(t)))];
  if (cleaned.includes('全部')) return ['全部'];
  return cleaned;
}

export function formatModeratorTopicsLabel(topics, { emptyLabel = '—' } = {}) {
  const normalized = normalizeModeratorTopics(topics);
  if (!normalized.length) return emptyLabel;
  if (normalized.includes('全部')) return '全部版塊';
  return normalized.join('、');
}

/** Consistent scope label for moderation UIs (queue actor or profile). */
export function formatActorScopeLabel(actor, { emptyModeratorLabel = '全部版塊（預設）' } = {}) {
  if (!actor) return '—';
  if (actor.role === 'admin' || actor.via_dashboard || actor.viaDashboard) return '全部版塊';
  const topics = actor.moderator_topics ?? actor.moderatorTopics ?? null;
  return formatModeratorTopicsLabel(topics, { emptyLabel: emptyModeratorLabel });
}

/**
 * @param {{ role: string, viaDashboard?: boolean, moderatorTopics?: string[]|null }} actor
 * @param {string|null|undefined} storedTopic — raw DB topic on post
 */
export function canModerateStoredTopic(actor, storedTopic) {
  if (!actor) return false;
  if (actor.viaDashboard || canAdminForum(actor.role)) return true;
  if (!canModerateForum(actor.role)) return false;

  const assignments = actor.moderatorTopics;
  if (!assignments?.length) return true;

  if (assignments.includes('全部')) return true;

  const canonical = displayTopic(storedTopic);
  return assignments.includes(canonical);
}

export async function getModeratorTopicsMap(admin, userIds) {
  const map = new Map();
  if (!userIds?.length) return map;

  const { data, error } = await admin
    .from('forum_moderator_assignments')
    .select('user_id, topic')
    .in('user_id', userIds);

  if (error) {
    if (isMissingAssignmentsTable(error)) return map;
    throw error;
  }

  for (const row of data || []) {
    const list = map.get(row.user_id) || [];
    list.push(row.topic);
    map.set(row.user_id, list);
  }

  for (const [userId, topics] of map) {
    map.set(userId, normalizeModeratorTopics(topics));
  }

  return map;
}

export async function getModeratorTopicsForUser(admin, userId) {
  const map = await getModeratorTopicsMap(admin, [userId]);
  return map.get(userId) || [];
}

export async function setModeratorTopics(admin, userId, topics, { assignedBy = null } = {}) {
  const normalized = normalizeModeratorTopics(topics);
  if (!normalized.length) {
    return { ok: false, status: 400, error: '請至少選擇一個負責版塊。' };
  }

  const rows = normalized.map((topic) => ({
    user_id: userId,
    topic,
    assigned_by: assignedBy,
  }));

  const { error: upsertErr } = await admin
    .from('forum_moderator_assignments')
    .upsert(rows, { onConflict: 'user_id,topic' });

  if (upsertErr) {
    return assignmentsTableError(upsertErr, '無法儲存版塊指派');
  }

  const { error: delErr } = await admin
    .from('forum_moderator_assignments')
    .delete()
    .eq('user_id', userId)
    .not('topic', 'in', topicInFilter(normalized));

  if (delErr) {
    return assignmentsTableError(delErr, '無法更新版塊指派');
  }

  return { ok: true, topics: normalized };
}

export async function clearModeratorTopics(admin, userId) {
  const { error } = await admin
    .from('forum_moderator_assignments')
    .delete()
    .eq('user_id', userId);

  if (error && !isMissingAssignmentsTable(error)) {
    return assignmentsTableError(error, '無法清除版塊指派');
  }
  return { ok: true };
}

export async function getPostStoredTopic(admin, postId) {
  const { data } = await admin
    .from('forum_posts')
    .select('topic')
    .eq('id', postId)
    .maybeSingle();
  return data?.topic || null;
}

export async function getCommentPostStoredTopic(admin, commentId) {
  const { data } = await admin
    .from('forum_comments')
    .select('post_id')
    .eq('id', commentId)
    .maybeSingle();
  if (!data?.post_id) return null;
  return getPostStoredTopic(admin, data.post_id);
}

/**
 * Filter queue items to those the actor may moderate.
 */
export function filterQueueForActor(actor, { posts = [], comments = [] }, postTopicById = {}) {
  const scopedPosts = (posts || []).filter((p) => canModerateStoredTopic(actor, p.topic));
  const scopedComments = (comments || []).filter((c) => {
    const topic = postTopicById[c.post_id];
    return canModerateStoredTopic(actor, topic);
  });
  return { posts: scopedPosts, comments: scopedComments };
}

/**
 * Load moderators who should be notified for a stored post topic.
 */
export async function getModeratorsForStoredTopic(admin, storedTopic) {
  const { data: staff, error } = await admin
    .from('profiles')
    .select('id, forum_role')
    .in('forum_role', ['moderator', 'admin'])
    .eq('status', 'active');

  if (error || !staff?.length) return [];

  const modIds = staff.filter((s) => s.forum_role === 'moderator').map((s) => s.id);
  const topicsMap = await getModeratorTopicsMap(admin, modIds);

  return staff.filter((profile) => {
    if (profile.forum_role === 'admin') return true;
    const actor = {
      role: 'moderator',
      moderatorTopics: topicsMap.get(profile.id) || [],
    };
    return canModerateStoredTopic(actor, storedTopic);
  });
}
