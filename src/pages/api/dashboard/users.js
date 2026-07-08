/**
 * GET  /api/dashboard/users
 *   ?q=<search>        — search by email or display_name (optional)
 *   ?status=<status>   — filter by profiles.status (optional)
 *   ?limit=&offset=    — pagination (default 50)
 *
 * PATCH /api/dashboard/users
 *   Body: { user_id, action: 'suspend' | 'activate' | 'ban' }
 *
 * Admin-only (x-dashboard-key header).
 */

import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';
import { getAdminClient } from '../../../lib/server-auth.js';

function escapeIlike(value) {
  return value.replace(/[%_\\]/g, '\\$&');
}

async function searchAuthUsersViaRpc(admin, q, maxResults = 20) {
  const { data, error } = await admin.rpc('dashboard_search_auth_users', {
    search_query: q,
    result_limit: maxResults,
  });
  if (error) {
    console.warn('[dashboard/users] RPC search failed:', error.message);
    return null;
  }
  return data || [];
}

async function searchAuthUsersViaGoTrueFilter(q) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return [];

  try {
    const url = new URL(`${base.replace(/\/$/, '')}/auth/v1/admin/users`);
    url.searchParams.set('page', '1');
    url.searchParams.set('per_page', '50');
    url.searchParams.set('filter', q);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    });
    if (!res.ok) return [];

    const body = await res.json();
    const users = body?.users || [];
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
    }));
  } catch (err) {
    console.warn('[dashboard/users] GoTrue filter search failed:', err?.message);
    return [];
  }
}

async function searchAuthUsersViaList(admin, q, maxResults = 20) {
  const needle = q.toLowerCase();
  const matches = [];
  let page = 1;

  while (matches.length < maxResults && page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;

    for (const user of data.users) {
      if (user.email?.toLowerCase().includes(needle)) {
        matches.push({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        });
        if (matches.length >= maxResults) break;
      }
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  return matches;
}

async function searchAuthUsers(admin, q, maxResults = 20) {
  const rpcResults = await searchAuthUsersViaRpc(admin, q, maxResults);
  if (rpcResults?.length) return rpcResults;

  const filterResults = await searchAuthUsersViaGoTrueFilter(q);
  if (filterResults.length) return filterResults.slice(0, maxResults);

  return searchAuthUsersViaList(admin, q, maxResults);
}

async function enrichProfilesWithEmail(admin, profiles) {
  if (!profiles?.length) return [];
  return Promise.all(
    profiles.map(async (profile) => {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(profile.id);
        return { ...profile, email: user?.email || null };
      } catch {
        return { ...profile, email: null };
      }
    })
  );
}

function mergeAuthUsersWithProfiles(authUsers, profiles, statusFilter) {
  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const users = authUsers.map((au) => {
    const profile = profileMap[au.id];
    if (profile) {
      return { ...profile, email: au.email || profile.email || null };
    }
    return {
      id: au.id,
      display_name: null,
      bio: null,
      status: 'active',
      subscription_tier: 'free',
      created_at: au.created_at,
      updated_at: null,
      email: au.email,
      profile_missing: true,
    };
  });

  if (!statusFilter) return users;
  return users.filter((u) => u.status === statusFilter);
}

export default async function handler(req, res) {
  if (!(await authorizeStationOrForumAdmin(req, res))) return;

  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'PATCH') return handlePatch(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  const admin = getAdminClient();
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const q = req.query.q?.trim();
  const statusFilter = req.query.status;

  if (q && q.includes('@')) {
    const authUsers = await searchAuthUsers(admin, q, Math.min(limit, 20));
    if (!authUsers.length) {
      return res.status(200).json({ users: [], total: 0, limit, offset });
    }

    const ids = authUsers.map((u) => u.id);
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, display_name, bio, status, subscription_tier, forum_role, created_at, updated_at, moon_journey_exp, moon_journey_level, moon_checkin_streak, moon_last_checkin_date')
      .in('id', ids);

    if (error) return res.status(500).json({ error: 'Database error' });

    const users = mergeAuthUsersWithProfiles(authUsers, profiles, statusFilter);
    return res.status(200).json({ users, total: users.length, limit, offset });
  }

  let query = admin
    .from('profiles')
    .select('id, display_name, bio, status, subscription_tier, forum_role, created_at, updated_at, moon_journey_exp, moon_journey_level, moon_checkin_streak, moon_last_checkin_date', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    const safe = escapeIlike(q);
    query = query.ilike('display_name', `%${safe}%`);
  }
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: 'Database error' });

  const users = await enrichProfilesWithEmail(admin, data || []);
  return res.status(200).json({ users, total: count, limit, offset });
}

async function handlePatch(req, res) {
  const body = req.body || {};
  const { user_id, action } = body;

  if (!user_id || !action) return res.status(400).json({ error: 'user_id and action required' });

  const validActions = { suspend: 'suspended', activate: 'active', ban: 'banned' };
  if (!validActions[action]) return res.status(400).json({ error: 'Invalid action' });

  const admin = getAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ status: validActions[action], updated_at: new Date().toISOString() })
    .eq('id', user_id);

  if (error) return res.status(500).json({ error: 'Update failed' });
  return res.status(200).json({ success: true, new_status: validActions[action] });
}
