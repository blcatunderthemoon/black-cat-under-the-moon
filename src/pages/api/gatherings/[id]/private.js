/**
 * GET /api/gatherings/[id]/private — private location (host or approved)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { canViewPrivateLocation, maybeMarkCompleted } from '../../../../lib/gatherings.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少聚會 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const { data: row } = await admin.from('gatherings').select('*').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: '找不到此聚會。' });
  await maybeMarkCompleted(admin, row);

  const allowed = await canViewPrivateLocation(admin, row, user.id);
  if (!allowed) {
    return res.status(403).json({ error: '獲批准參加後先可以看到私密地點。', code: 'not_approved' });
  }

  return res.status(200).json({
    location_private: row.location_private || null,
    is_online: row.is_online,
  });
}
