/**
 * POST /api/wishes/[id]/complete — mark complete + award shards
 * Body: { completion_note?: string }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import {
  maybeExpireWish,
  normalizeWishText,
  WISH_COMPLETION_NOTE_MAX,
  WISH_COMPLETE_MIN_AGE_MS,
  toPublicWish,
  enrichWishOwners,
} from '../../../../lib/wishes.js';
import {
  awardWishCompleteShards,
  WISH_COMPLETE_SHARDS,
} from '../../../../lib/my-cat-awards.js';
import { notifyWishCheerersCompleted } from '../../../../lib/wish-notify.js';
import { databaseNowIso } from '../../../../lib/hong-kong-time.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少心願 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const completionNote = normalizeWishText(body.completion_note, WISH_COMPLETION_NOTE_MAX);

  const { data: row } = await admin.from('wishes').select('*').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: '找不到此心願。' });

  const wish = await maybeExpireWish(admin, row);
  if (wish.user_id !== user.id) {
    return res.status(403).json({ error: '只有你可以完成自己嘅心願。' });
  }
  if (wish.status === 'completed') {
    const award = await awardWishCompleteShards(admin, user.id, wish.id);
    const ownerMap = await enrichWishOwners(admin, [wish]);
    return res.status(200).json({
      wish: toPublicWish(wish, { owner: ownerMap.get(wish.user_id) }),
      shards_gained: award.shards_gained || 0,
      already_completed: true,
    });
  }
  if (!['active', 'expired'].includes(wish.status)) {
    return res.status(400).json({ error: '此心願無法標記完成。' });
  }

  const ageMs = Date.now() - new Date(wish.created_at).getTime();
  if (ageMs < WISH_COMPLETE_MIN_AGE_MS) {
    const hoursLeft = Math.ceil((WISH_COMPLETE_MIN_AGE_MS - ageMs) / (60 * 60 * 1000));
    return res.status(400).json({
      error: `設立後需等待至少 24 小時才可領取完成獎勵（約剩 ${hoursLeft} 小時）。`,
      code: 'too_soon',
    });
  }

  const { data: updated, error } = await admin
    .from('wishes')
    .update({
      status: 'completed',
      progress: 100,
      completed_at: databaseNowIso(),
      completion_note: completionNote,
    })
    .eq('id', wish.id)
    .in('status', ['active', 'expired'])
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[wishes/complete] update failed:', error.message);
    return res.status(500).json({ error: '完成失敗。' });
  }
  if (!updated) {
    return res.status(409).json({ error: '心願狀態已變更，請重新整理。' });
  }

  let award = { awarded: false, shards_gained: 0, reason: null };
  try {
    award = await awardWishCompleteShards(admin, user.id, wish.id);
  } catch (err) {
    console.error('[wishes/complete] award failed:', err?.message || err);
  }

  const { data: cheerers } = await admin
    .from('wish_cheers')
    .select('user_id')
    .eq('wish_id', wish.id);
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const cheererIds = [...new Set((cheerers || []).map((c) => c.user_id))];
  if (cheererIds.length) {
    notifyWishCheerersCompleted({
      userIds: cheererIds,
      wishId: wish.id,
      wishTitle: wish.title,
      ownerName: ownerProfile?.display_name || '她',
    }).catch(() => {});
  }

  const ownerMap = await enrichWishOwners(admin, [updated]);

  return res.status(200).json({
    wish: toPublicWish(updated, { owner: ownerMap.get(updated.user_id) }),
    shards_gained: award.shards_gained || 0,
    shards_expected: WISH_COMPLETE_SHARDS,
  });
}
