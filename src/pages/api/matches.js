/**
 * GET /api/matches
 * Echo list source of truth:
 * - Passport (or soft unlock): live pairs computed from `responses` only (≥60).
 *   Inbox / sent_matches do NOT add or keep people on this list.
 * - Free tier: delivered matches only (inbox + sent_matches) — no live scan.
 */

import { requireUser, sendAuthError, getAdminClient, isPremium } from '../../lib/server-auth.js';
import { loadUserMatches } from '../../lib/user-matches.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const premium = await isPremium(user.id);
  const admin = getAdminClient();
  const { matches, has_submitted } = await loadUserMatches(admin, user.id, user.email, {
    // Passport Echo: responses-only discovery. Free: delivered tables only.
    includeDiscovery: premium,
    responsesOnly: premium,
  });

  return res.status(200).json({
    matches,
    has_submitted,
    premium,
    discovery_enabled: premium,
    source: premium ? 'responses' : 'delivered',
  });
}
