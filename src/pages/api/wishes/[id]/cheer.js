/**
 * POST /api/wishes/[id]/cheer — cheer a wish (auth, irreversible)
 * Body: { note?: string }
 */

import { requireUser, sendAuthError, getAdminClient, ensureProfile } from '../../../../lib/server-auth.js';
import {
  maybeExpireWish,
  canViewerSeeWish,
  normalizeWishText,
  WISH_CHEER_NOTE_MAX,
  WISH_CHEER_DAILY_LIMIT,
  hongKongDayStartIso,
  toPublicWish,
  enrichWishOwners,
} from '../../../../lib/wishes.js';
import { awardWishCheerMilestone } from '../../../../lib/my-cat-awards.js';
import { notifyWishOwnerCheered } from '../../../../lib/wish-notify.js';
import {
  createRateLimiter,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../../lib/rate-limit.js';

const cheerLimiter = createRateLimiter('wish-cheer', 40, '1 h');

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

  const limited = await rateLimitOrPass(cheerLimiter, `wish-cheer:${user.id}`);
  if (!limited.ok) return rateLimitResponse(res, limited.reason);

  await ensureProfile(user);
  const admin = getAdminClient();
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const note = normalizeWishText(body.note, WISH_CHEER_NOTE_MAX);

  const { data: row, error } = await admin.from('wishes').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[wishes/cheer] load failed:', error.message);
    return res.status(500).json({ error: '無法打氣。' });
  }
  if (!row) return res.status(404).json({ error: '找不到此心願。' });

  const wish = await maybeExpireWish(admin, row);
  if (!canViewerSeeWish(wish, user.id) || wish.status !== 'active') {
    return res.status(400).json({ error: '此心願目前不能打氣。' });
  }
  if (wish.user_id === user.id) {
    return res.status(400).json({ error: '不能為自己的心願打氣。' });
  }

  const { data: existing } = await admin
    .from('wish_cheers')
    .select('id')
    .eq('wish_id', wish.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const ownerMap = await enrichWishOwners(admin, [wish]);
    return res.status(200).json({
      cheered: true,
      cheer_count: wish.cheer_count || 0,
      wish: toPublicWish(wish, {
        owner: ownerMap.get(wish.user_id),
        cheered: true,
      }),
    });
  }

  const dayStart = hongKongDayStartIso();
  const { count: dayCheers } = await admin
    .from('wish_cheers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', dayStart);

  if ((dayCheers ?? 0) >= WISH_CHEER_DAILY_LIMIT) {
    return res.status(429).json({
      error: `每日最多打氣 ${WISH_CHEER_DAILY_LIMIT} 次。`,
      code: 'daily_cheer_limit',
    });
  }

  // Soft pair cap: max 1 cheer per day toward the same wish owner.
  const { data: ownerWishIds } = await admin
    .from('wishes')
    .select('id')
    .eq('user_id', wish.user_id);
  const ownerIds = (ownerWishIds || []).map((w) => w.id);
  if (ownerIds.length) {
    const { count: pairToday } = await admin
      .from('wish_cheers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('wish_id', ownerIds)
      .gte('created_at', dayStart);
    if ((pairToday ?? 0) >= 1) {
      return res.status(429).json({
        error: '今日已為這位貓咪打過氣，明日再來吧。',
        code: 'pair_daily_limit',
      });
    }
  }

  const { error: insErr } = await admin.from('wish_cheers').insert({
    wish_id: wish.id,
    user_id: user.id,
    note,
  });
  if (insErr) {
    if (insErr.code === '23505') {
      return res.status(200).json({ cheered: true, cheer_count: wish.cheer_count });
    }
    console.error('[wishes/cheer] insert failed:', insErr.message);
    return res.status(500).json({ error: '打氣失敗。' });
  }

  const nextCount = (wish.cheer_count || 0) + 1;
  const { data: updated } = await admin
    .from('wishes')
    .update({ cheer_count: nextCount })
    .eq('id', wish.id)
    .select('*')
    .single();

  try {
    await awardWishCheerMilestone(admin, wish.user_id, wish.id, nextCount);
  } catch (err) {
    console.error('[wishes/cheer] milestone failed:', err?.message || err);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  notifyWishOwnerCheered({
    ownerId: wish.user_id,
    wishId: wish.id,
    wishTitle: wish.title,
    cheererName: profile?.display_name || '一位貓咪',
  }).catch(() => {});

  const ownerMap = await enrichWishOwners(admin, [updated || wish]);
  return res.status(200).json({
    cheered: true,
    cheer_count: nextCount,
    wish: toPublicWish(updated || { ...wish, cheer_count: nextCount }, {
      owner: ownerMap.get(wish.user_id),
      cheered: true,
    }),
  });
}
