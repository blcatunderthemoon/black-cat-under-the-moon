/**
 * POST /api/my-cat/rename — name the cat (one shot for now).
 * Body: { name: string }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { performCatRename } from '../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const admin = getAdminClient();
    const result = await performCatRename(admin, user.id, body.name);
    if (!result.ok) {
      return res.status(result.already_renamed ? 409 : 400).json({ error: result.error });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[my-cat/rename] failed:', err?.message || err);
    return res.status(500).json({ error: '改名失敗，請稍後再試。' });
  }
}
