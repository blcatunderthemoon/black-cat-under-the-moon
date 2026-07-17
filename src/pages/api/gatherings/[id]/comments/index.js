/**
 * GET  /api/gatherings/[id]/comments — list board messages (host + approved only)
 * POST /api/gatherings/[id]/comments — post a message (host + approved only)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';
import { filterContent } from '../../../../../lib/content-filter.js';
import { getGatheringBoardAccess } from '../../../../../lib/gatherings.js';
import { databaseNowIso } from '../../../../../lib/hong-kong-time.js';

const MAX_BODY = 500;

async function decorateComments(admin, rows, viewerId, isHost) {
  const userIds = [...new Set((rows || []).map((r) => r.user_id))];
  let profileMap = new Map();
  let mirrorMap = new Map();
  if (userIds.length) {
    const [{ data: profiles }, { data: mirrors }] = await Promise.all([
      admin.from('profiles').select('id, display_name, avatar_style').in('id', userIds),
      admin.from('mirror_cards').select('user_id, mirror_type').in('user_id', userIds),
    ]);
    profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    mirrorMap = new Map((mirrors || []).map((m) => [m.user_id, m.mirror_type]));
  }
  return (rows || []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    body: r.body,
    created_at: r.created_at,
    display_name: profileMap.get(r.user_id)?.display_name || '匿名貓咪',
    avatar_style: profileMap.get(r.user_id)?.avatar_style || null,
    mirror_type: mirrorMap.get(r.user_id) || null,
    is_mine: r.user_id === viewerId,
    can_delete: isHost || r.user_id === viewerId,
  }));
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少聚會 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const access = await getGatheringBoardAccess(admin, id, user.id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error, code: access.code });
  }

  if (req.method === 'GET') {
    const { data: rows, error } = await admin
      .from('gathering_comments')
      .select('id, user_id, body, created_at')
      .eq('gathering_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) {
      console.error('[gatherings/comments] list failed:', error.message);
      return res.status(500).json({ error: '無法載入留言。' });
    }
    const comments = await decorateComments(admin, rows, user.id, access.isHost);
    return res.status(200).json({ comments, is_host: access.isHost });
  }

  if (req.method === 'POST') {
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ error: '請輸入留言內容。' });
    if (body.length > MAX_BODY) return res.status(400).json({ error: `留言最多 ${MAX_BODY} 字。` });

    const filtered = filterContent(body);
    if (filtered.blocked) {
      if (filtered.crisis) return res.status(451).json({ error: 'crisis', crisis: true });
      return res.status(422).json({ error: '留言包含不允許的詞語。' });
    }

    const { data: inserted, error } = await admin
      .from('gathering_comments')
      .insert({
        gathering_id: id,
        user_id: user.id,
        body,
        updated_at: databaseNowIso(),
      })
      .select('id, user_id, body, created_at')
      .single();
    if (error) {
      console.error('[gatherings/comments] insert failed:', error.message);
      return res.status(500).json({ error: '留言失敗，請稍後再試。' });
    }

    const [comment] = await decorateComments(admin, [inserted], user.id, access.isHost);
    return res.status(201).json({ comment });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
