/**
 * POST /api/dashboard/send-emails
 *
 * Body: {
 *   pairs: [{ userAId, userBId, match_score }],
 *   deliver_inbox?: boolean,   // when true, also push Inbox for registered users
 *   skip_quota_check?: boolean // admin override (use sparingly)
 * }
 */

import { sendMatchNotificationPairs } from '../../../lib/match-notify-send.js';
import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';

export default async function handler(req, res) {
  if (!(await authorizeStationOrForumAdmin(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { pairs, deliver_inbox: deliverInbox = false, skip_quota_check: skipQuotaCheck = false } = body;

  if (!Array.isArray(pairs) || pairs.length === 0) {
    return res.status(400).json({ error: 'pairs must be a non-empty array' });
  }

  for (const p of pairs) {
    const a = Number(p.userAId);
    const b = Number(p.userBId);
    if (!a || !b || a === b || !Number.isInteger(a) || !Number.isInteger(b)) {
      return res.status(400).json({ error: `Invalid pair: ${JSON.stringify(p)}` });
    }
  }

  const outcome = await sendMatchNotificationPairs(pairs, { deliverInbox, skipQuotaCheck });
  if (!outcome.ok) {
    return res.status(outcome.status || 500).json({
      error: outcome.error,
      hint: outcome.hint,
    });
  }

  return res.status(200).json({ success: true, results: outcome.results });
}
