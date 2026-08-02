/**
 * GET /api/matches
 * Echo list:
 * - Passport: who appears = live `responses` pairs ≥60 only.
 *   `sent_matches` only sets「電郵通知」(email_notified) on those rows.
 * - Free: delivered matches (inbox + sent_matches).
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
