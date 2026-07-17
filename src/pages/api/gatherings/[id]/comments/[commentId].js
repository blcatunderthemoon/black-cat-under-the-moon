/**
 * DELETE /api/gatherings/[id]/comments/[commentId]
 * Host can delete any board message; author can delete their own.
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';
import { getGatheringBoardAccess } from '../../../../../lib/gatherings.js';
import { databaseNowIso } from '../../../../../lib/hong-kong-time.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { id, commentId } = req.query;
  if (!id || !commentId) return res.status(400).json({ error: '缺少參數' });

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

  const { data: comment } = await admin
    .from('gathering_comments')
    .select('id, user_id, gathering_id, deleted_at')
    .eq('id', commentId)
    .eq('gathering_id', id)
    .maybeSingle();
  if (!comment || comment.deleted_at) return res.status(404).json({ error: '找不到此留言。' });

  if (!access.isHost && comment.user_id !== user.id) {
    return res.status(403).json({ error: '只可以刪除自己嘅留言。' });
  }

  const { error } = await admin
    .from('gathering_comments')
    .update({
      deleted_at: databaseNowIso(),
      deleted_by: user.id,
      updated_at: databaseNowIso(),
    })
    .eq('id', commentId);
  if (error) {
    console.error('[gatherings/comments] delete failed:', error.message);
    return res.status(500).json({ error: '刪除失敗。' });
  }

  return res.status(200).json({ success: true });
}
