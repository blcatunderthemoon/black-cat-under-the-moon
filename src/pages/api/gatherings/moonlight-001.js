/**
 * GET /api/gatherings/moonlight-001 — public card for #001 (capacity / seats).
 */

import { getAdminClient } from '../../../lib/server-auth.js';
import { resolveMoonlightGathering001Card } from '../../../lib/moonlight-gathering-001.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const admin = getAdminClient();
    const card = await resolveMoonlightGathering001Card(admin);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ card });
  } catch (err) {
    console.error('[gatherings/moonlight-001]', err);
    return res.status(500).json({ error: '無法載入聚會資料' });
  }
}
