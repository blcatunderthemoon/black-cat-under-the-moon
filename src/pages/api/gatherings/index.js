/**
 * GET  /api/gatherings — list gatherings (filters)
 * POST /api/gatherings — create gathering (host gate)
 */

import { requireUser, sendAuthError, getAdminClient, ensureProfile } from '../../../lib/server-auth.js';
import {
  loadGatheringActor,
  assertCanHost,
  validateGatheringInput,
  countOpenHostedGatherings,
  countHostedThisHkMonth,
  GATHERING_OPEN_HOST_LIMIT,
  GATHERING_MONTHLY_HOST_LIMIT,
  toPublicGathering,
  enrichHosts,
  getAttendanceMap,
  maybeMarkCompleted,
} from '../../../lib/gatherings.js';
import { databaseNowIso } from '../../../lib/hong-kong-time.js';

async function handleGet(req, res) {
  let user = null;
  try {
    user = await requireUser(req);
  } catch {
    user = null;
  }

  const admin = getAdminClient();
  const {
    from,
    to,
    tag,
    online,
    open_only: openOnly,
    family,
    host,
    joined,
    limit: limitRaw,
  } = req.query;

  const limit = Math.min(Math.max(Number(limitRaw) || 40, 1), 100);

  if (joined === 'me') {
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { data: attRows, error: attErr } = await admin
      .from('gathering_attendees')
      .select('gathering_id, status, knock_message')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (attErr) {
      console.error('[gatherings] joined list failed:', attErr.message);
      return res.status(500).json({ error: '無法載入聚會列表。' });
    }
    const ids = (attRows || []).map((a) => a.gathering_id);
    if (!ids.length) return res.status(200).json({ gatherings: [], total: 0 });

    const { data, error } = await admin
      .from('gatherings')
      .select('*')
      .in('id', ids);
    if (error) {
      console.error('[gatherings] joined gatherings failed:', error.message);
      return res.status(500).json({ error: '無法載入聚會列表。' });
    }
    const byId = new Map((data || []).map((r) => [r.id, r]));
    const rows = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (row) rows.push(await maybeMarkCompleted(admin, row));
    }
    const hostMap = await enrichHosts(admin, rows);
    const attendanceByGathering = new Map((attRows || []).map((a) => [a.gathering_id, a]));
    const gatherings = rows.map((row) => toPublicGathering(row, {
      host: hostMap.get(row.host_id) || null,
      myAttendance: attendanceByGathering.get(row.id) || null,
    }));
    return res.status(200).json({ gatherings, total: gatherings.length });
  }

  let query = admin
    .from('gatherings')
    .select('*')
    .in('status', ['open', 'full', 'completed', 'cancelled'])
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (from) query = query.gte('starts_at', new Date(from).toISOString());
  if (to) query = query.lte('starts_at', new Date(to).toISOString());
  if (!from && !to && host !== 'me') {
    query = query.gte('starts_at', databaseNowIso());
  }
  if (tag) query = query.contains('tags', [String(tag)]);
  if (online === '1') query = query.eq('is_online', true);
  if (online === '0') query = query.eq('is_online', false);
  if (openOnly === '1') query = query.eq('status', 'open');
  if (family) query = query.contains('allowed_mirror_families', [String(family)]);
  if (host === 'me') {
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    query = query.eq('host_id', user.id);
  } else {
    // Hide reported-and-auto-hidden gatherings from the public calendar.
    query = query.eq('is_hidden', false);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[gatherings] list failed:', error.message);
    if (error.message?.includes('gatherings')) {
      return res.status(503).json({ error: '月光聚會尚未啟用，請先執行 migration。' });
    }
    return res.status(500).json({ error: '無法載入聚會列表。' });
  }

  const rows = [];
  for (const row of data || []) {
    rows.push(await maybeMarkCompleted(admin, row));
  }

  const hostMap = await enrichHosts(admin, rows);
  const attendanceMap = user
    ? await getAttendanceMap(admin, rows.map((r) => r.id), user.id)
    : new Map();

  const gatherings = rows.map((row) => toPublicGathering(row, {
    host: hostMap.get(row.host_id) || null,
    myAttendance: attendanceMap.get(row.id) || null,
  }));

  return res.status(200).json({ gatherings, total: gatherings.length });
}

async function handlePost(req, res) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  await ensureProfile(user);
  const admin = getAdminClient();
  const actor = await loadGatheringActor(admin, user.id);
  if (!actor.ok) return res.status(actor.status).json({ error: actor.error, code: actor.code });

  const hostGate = assertCanHost(actor);
  if (!hostGate.ok) return res.status(hostGate.status).json({ error: hostGate.error, code: hostGate.code });

  const openCount = await countOpenHostedGatherings(admin, user.id);
  if (openCount >= GATHERING_OPEN_HOST_LIMIT) {
    return res.status(429).json({
      error: `同時最多可有 ${GATHERING_OPEN_HOST_LIMIT} 場進行中的聚會。`,
      code: 'open_limit',
    });
  }

  const monthCount = await countHostedThisHkMonth(admin, user.id);
  if (monthCount >= GATHERING_MONTHLY_HOST_LIMIT) {
    return res.status(429).json({
      error: `本月發起上限為 ${GATHERING_MONTHLY_HOST_LIMIT} 場。`,
      code: 'monthly_limit',
    });
  }

  const validated = validateGatheringInput(req.body || {});
  if (!validated.ok) {
    return res.status(validated.status).json({
      error: validated.error,
      crisis: validated.crisis || false,
      errors: validated.errors,
    });
  }

  const payload = {
    host_id: user.id,
    ...validated.data,
    status: 'open',
    approved_count: 0,
  };

  const { data, error } = await admin
    .from('gatherings')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[gatherings] create failed:', error.message, error.code, error.details);
    const msg = String(error.message || '');
    if (
      msg.includes('schema cache')
      || msg.includes('does not exist')
      || msg.includes('gatherings')
      || error.code === 'PGRST204'
      || error.code === 'PGRST205'
      || error.code === '42P01'
    ) {
      return res.status(503).json({
        error: '月光聚會資料庫尚未就緒。請在 Supabase 依序執行 gatherings migrations（含聯絡欄位），然後執行：NOTIFY pgrst, \'reload schema\';',
        code: 'migration_required',
        detail: process.env.NODE_ENV === 'development' ? msg : undefined,
      });
    }
    return res.status(500).json({
      error: '發起聚會失敗，請稍後再試。',
      detail: process.env.NODE_ENV === 'development' ? msg : undefined,
    });
  }

  return res.status(201).json({
    gathering: toPublicGathering(data, {
      host: {
        id: user.id,
        display_name: actor.profile.display_name,
        mirror_type: actor.mirrorType,
      },
      includePrivate: true,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
