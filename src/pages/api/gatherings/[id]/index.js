/**
 * GET   /api/gatherings/[id] — public detail
 * PATCH /api/gatherings/[id] — host edit (before start)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import {
  loadGatheringActor,
  validateGatheringInput,
  toPublicGathering,
  enrichHosts,
  getAttendanceMap,
  maybeMarkCompleted,
  canViewPrivateLocation,
} from '../../../../lib/gatherings.js';
import { databaseNowIso } from '../../../../lib/hong-kong-time.js';

async function loadGathering(admin, id) {
  const { data, error } = await admin.from('gatherings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少聚會 id' });

  const admin = getAdminClient();

  let user = null;
  try {
    user = await requireUser(req);
  } catch {
    user = null;
  }

  try {
    if (req.method === 'GET') {
      let row = await loadGathering(admin, id);
      if (!row) return res.status(404).json({ error: '找不到此聚會。' });
      row = await maybeMarkCompleted(admin, row);

      const hostMap = await enrichHosts(admin, [row]);
      const attendanceMap = user
        ? await getAttendanceMap(admin, [row.id], user.id)
        : new Map();
      const includePrivate = user
        ? await canViewPrivateLocation(admin, row, user.id)
        : false;

      return res.status(200).json({
        gathering: toPublicGathering(row, {
          host: hostMap.get(row.host_id) || null,
          myAttendance: attendanceMap.get(row.id) || null,
          includePrivate,
        }),
        is_host: !!(user && user.id === row.host_id),
      });
    }

    if (req.method === 'PATCH') {
      if (!user) {
        try {
          user = await requireUser(req);
        } catch (err) {
          return sendAuthError(res, err);
        }
      }

      const row = await loadGathering(admin, id);
      if (!row) return res.status(404).json({ error: '找不到此聚會。' });
      if (row.host_id !== user.id) return res.status(403).json({ error: '只有主辦人可以編輯。' });
      if (row.status === 'cancelled' || row.status === 'completed') {
        return res.status(409).json({ error: '已結束或取消的聚會無法編輯。' });
      }
      if (new Date(row.starts_at).getTime() <= Date.now()) {
        return res.status(409).json({ error: '聚會開始後無法編輯。' });
      }

      const actor = await loadGatheringActor(admin, user.id);
      if (!actor.ok) return res.status(actor.status).json({ error: actor.error });

      const validated = validateGatheringInput(req.body || {}, { partial: true });
      if (!validated.ok) {
        return res.status(validated.status).json({
          error: validated.error,
          crisis: validated.crisis || false,
        });
      }

      const { data, error } = await admin
        .from('gatherings')
        .update({ ...validated.data, updated_at: databaseNowIso() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[gatherings] patch failed:', error.message);
        return res.status(500).json({ error: '更新失敗。' });
      }

      return res.status(200).json({
        gathering: toPublicGathering(data, {
          host: {
            id: user.id,
            display_name: actor.profile.display_name,
            mirror_type: actor.mirrorType,
          },
          includePrivate: true,
        }),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[gatherings/id] failed:', err?.message || err);
    return res.status(500).json({ error: '伺服器錯誤。' });
  }
}
