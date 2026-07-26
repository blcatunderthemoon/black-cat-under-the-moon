/**
 * POST /api/wishes/[id]/checkin — stamp / unstamp today's moonlight seal
 * Body: { day?: 'YYYY-MM-DD' } — only today (HK) allowed
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import {
  maybeExpireWish,
  enrichWishOwners,
  toPublicWish,
  buildWishCheckinDays,
  syncWishProgressFromCheckins,
} from '../../../../lib/wishes.js';
import { getHongKongDateString as hkToday } from '../../../../lib/hong-kong-time.js';

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
  const today = hkToday();
  const day = typeof body.day === 'string' && body.day ? body.day : today;

  if (day !== today) {
    return res.status(400).json({
      error: '而家只可以蓋今日嘅印花——唔使補舊帳，慢慢嚟就好。',
      code: 'today_only',
    });
  }

  const { data: row } = await admin.from('wishes').select('*').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: '找不到此心願。' });

  const wish = await maybeExpireWish(admin, row);
  if (wish.user_id !== user.id) {
    return res.status(403).json({ error: '只有你可以為自己嘅心願蓋印花。' });
  }
  if (!['active', 'expired'].includes(wish.status)) {
    return res.status(400).json({ error: '此心願無法再蓋印。' });
  }

  const { days: windowDays } = buildWishCheckinDays(wish);
  if (!windowDays.includes(day)) {
    return res.status(400).json({
      error: '今日唔喺呢個心願嘅印花日子入面。',
      code: 'out_of_window',
    });
  }

  const { data: existing } = await admin
    .from('wish_checkins')
    .select('id')
    .eq('wish_id', wish.id)
    .eq('day_hk', day)
    .maybeSingle();

  let stamped = true;
  if (existing) {
    const { error: delErr } = await admin
      .from('wish_checkins')
      .delete()
      .eq('id', existing.id);
    if (delErr) {
      console.error('[wishes/checkin] delete failed:', delErr.message);
      return res.status(500).json({ error: '取消印花失敗。' });
    }
    stamped = false;
  } else {
    const { error: insErr } = await admin.from('wish_checkins').insert({
      wish_id: wish.id,
      user_id: user.id,
      day_hk: day,
    });
    if (insErr) {
      console.error('[wishes/checkin] insert failed:', insErr.message);
      if (insErr.code === '42P01' || String(insErr.message || '').includes('wish_checkins')) {
        return res.status(503).json({ error: '印花功能尚未啟用，請先執行 wish_checkins migration。' });
      }
      return res.status(500).json({ error: '蓋印失敗。' });
    }
    stamped = true;
  }

  let synced;
  try {
    synced = await syncWishProgressFromCheckins(admin, wish);
  } catch (err) {
    console.error('[wishes/checkin] sync failed:', err?.message || err);
    return res.status(500).json({ error: '更新進度失敗。' });
  }

  const ownerMap = await enrichWishOwners(admin, [synced.wish]);
  return res.status(200).json({
    wish: toPublicWish(synced.wish, { owner: ownerMap.get(synced.wish.user_id) }),
    day,
    stamped,
    stamped_days: synced.stampedDays,
    total_days: synced.total,
    message: stamped
      ? '打卡成功 · 今日印花已蓋好'
      : '已取消今日打卡',
  });
}
