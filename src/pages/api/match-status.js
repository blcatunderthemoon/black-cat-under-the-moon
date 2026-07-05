/**
 * GET /api/match-status — logged-in user submission check
 * POST /api/match-status — { email } submission check (anonymous revisit)
 *
 * Response: { has_submitted: boolean }
 */

import { requireUser, sendAuthError, getAdminClient, getProfile } from '../../lib/server-auth.js';
import { hasMatchSubmission, autoLinkLegacyMatchResponses } from '../../lib/match-submission.js';
import {
  createRateLimiter,
  getClientIp,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../lib/rate-limit.js';

const postLimiter = createRateLimiter('match-status-post', 12, '1 m');

export default async function handler(req, res) {
  const admin = getAdminClient();

  if (req.method === 'GET') {
    let user;
    try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

    const profile = await getProfile(user.id);
    const lookup = {
      userId: user.id,
      email: user.email,
      profileEmail: profile?.email,
    };

    let has_submitted = await hasMatchSubmission(admin, lookup);

    if (!has_submitted && user.email) {
      const linked = await autoLinkLegacyMatchResponses(admin, user.id, user.email);
      if (linked) {
        has_submitted = true;
      } else {
        has_submitted = await hasMatchSubmission(admin, lookup);
      }
    }

    return res.status(200).json({ has_submitted });
  }

  if (req.method === 'POST') {
    const ip = getClientIp(req);
    const limited = await rateLimitOrPass(postLimiter, `match-status:${ip}`);
    if (!limited.ok) return rateLimitResponse(res, limited.reason);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = (body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email is required' });

    const has_submitted = await hasMatchSubmission(admin, { email });
    return res.status(200).json({ has_submitted });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
