/**
 * GET /api/matches
 * Returns the current user's matches from inbox + sent_matches (email notifications).
 * Passport (or soft unlock): also includes live computed pairs ≥ 60 (immediate discovery).
 * Free tier: delivered matches only — no live scan.
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
    includeDiscovery: premium,
  });

  return res.status(200).json({
    matches,
    has_submitted,
    premium,
    discovery_enabled: premium,
  });
}
