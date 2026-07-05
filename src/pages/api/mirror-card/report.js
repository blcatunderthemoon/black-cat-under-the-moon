/**
 * POST /api/mirror-card/report
 * Body: { slug: string } or { card_id: string }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { shouldAutoHide } from '../../../lib/moderation.js';
import { databaseNowIso } from '../../../lib/hong-kong-time.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { slug, card_id: cardId } = body;

  const admin = getAdminClient();

  let query = admin.from('mirror_cards').select('id, user_id, report_count, is_published');
  if (cardId) {
    query = query.eq('id', cardId);
  } else if (slug) {
    query = query.eq('public_slug', slug);
  } else {
    return res.status(400).json({ error: 'slug or card_id required' });
  }

  const { data: card } = await query.maybeSingle();
  if (!card) return res.status(404).json({ error: 'Card not found' });
  if (card.user_id === user.id) {
    return res.status(400).json({ error: 'Cannot report your own card' });
  }

  const newCount = (card.report_count || 0) + 1;
  const patch = { report_count: newCount, updated_at: databaseNowIso() };
  if (shouldAutoHide(newCount)) {
    patch.is_published = false;
  }

  const { error } = await admin.from('mirror_cards').update(patch).eq('id', card.id);
  if (error) {
    console.error('[mirror-card/report]', error.message);
    return res.status(500).json({ error: 'Report failed' });
  }

  return res.status(200).json({
    success: true,
    report_count: newCount,
    auto_hidden: shouldAutoHide(newCount),
  });
}
