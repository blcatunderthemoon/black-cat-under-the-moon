/**
 * POST /api/my-cat/feed — 一日兩餐（§5.2, docs/MY-CAT-GAME-DESIGN.md）。
 * 早餐 00:00–17:00、晚餐 17:01–23:59，各一次：每餐飽腹回滿 100、碎屑早 +2 / 晚 +1。
 * 當日第一餐順便完成 Moon Journey 打卡（+2 EXP、streak +1）。
 * 每餐冪等（ledger source_id = `${date}#am|pm`）；重複呼叫回 already_fed_today。
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { performCatFeed } from '../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  try {
    const admin = getAdminClient();
    const result = await performCatFeed(admin, user.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[my-cat/feed] failed:', err?.message || err);
    return res.status(500).json({ error: '餵食失敗，請稍後再試。' });
  }
}
