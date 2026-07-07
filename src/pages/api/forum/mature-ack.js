/**
 * GET  /api/forum/mature-ack — whether viewer confirmed 18+ for mature forum
 * POST /api/forum/mature-ack — persist confirmation (logged-in users only)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { databaseNowIso } from '../../../lib/hong-kong-time.js';

async function readAckAt(admin, userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('forum_mature_ack_at')
    .eq('id', userId)
    .maybeSingle();

  if (error?.code === '42703') return null;
  if (error) {
    console.error('[forum/mature-ack] read failed:', error.message);
    return null;
  }
  return data?.forum_mature_ack_at || null;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const ackAt = await readAckAt(admin, user.id);
  return res.status(200).json({
    acknowledged: !!ackAt,
    acknowledged_at: ackAt,
  });
}

async function handlePost(req, res) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const existing = await readAckAt(admin, user.id);
  if (existing) {
    return res.status(200).json({
      acknowledged: true,
      acknowledged_at: existing,
    });
  }

  const now = databaseNowIso();
  const { data, error } = await admin
    .from('profiles')
    .update({ forum_mature_ack_at: now })
    .eq('id', user.id)
    .select('forum_mature_ack_at')
    .single();

  if (error?.code === '42703') {
    return res.status(503).json({
      error: '成熟話題確認功能尚未啟用，請聯絡管理員執行資料庫遷移。',
      code: 'migration_required',
    });
  }
  if (error) {
    console.error('[forum/mature-ack] update failed:', error.message);
    return res.status(500).json({ error: '無法儲存確認狀態，請稍後再試。' });
  }

  return res.status(200).json({
    acknowledged: true,
    acknowledged_at: data?.forum_mature_ack_at || now,
  });
}
