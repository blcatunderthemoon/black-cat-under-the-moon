/**
 * POST /api/my-cat/pet — Tap to Meow (§4.1, docs/my-cat/MY-CAT-GAME-DESIGN.md).
 * First 5 taps per HK day: +2 affection each. Always returns a cat line.
 * Body (optional): { last_line: string } to avoid repeating the same line.
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { performCatPet } from '../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const lastLine = typeof body.last_line === 'string' ? body.last_line.slice(0, 200) : null;

    const admin = getAdminClient();
    const result = await performCatPet(admin, user.id, { lastLine });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[my-cat/pet] failed:', err?.message || err);
    return res.status(500).json({ error: '貓咪暫時唔想被摸，請稍後再試。' });
  }
}
