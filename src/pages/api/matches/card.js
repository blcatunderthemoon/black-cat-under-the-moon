/**
 * POST /api/matches/card
 * Generate match card HTML for a verified match pair.
 * Passport: any pair with sent_matches or live score ≥ 60.
 * Free: only pairs recorded in sent_matches (delivered connection).
 *
 * Stale questionnaire ids (after register / resubmit) are resolved to the same
 * person's latest response — no duplicate match rows are created.
 * Inbox-delivered pairs stay openable even if live recompute dips below 60.
 */

import { requireUser, sendAuthError, getAdminClient, isPremium } from '../../../lib/server-auth.js';
import {
  loadAuthorizedMatchPair,
  loadUserResponseIds,
  toResponseId,
} from '../../../lib/user-matches.js';
import { buildMatchCardHtml } from '../../../lib/match-card-html.js';
import { getSiteUrlFromRequest } from '../../../lib/site-seo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let user;
    try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

    const premium = await isPremium(user.id);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const partnerResponseId = toResponseId(body.partner_response_id);
    const requestedMyId = toResponseId(body.my_response_id);
    if (!partnerResponseId) {
      return res.status(400).json({ error: 'partner_response_id is required' });
    }

    const admin = getAdminClient();
    const myResponseIds = await loadUserResponseIds(admin, user.id, user.email);
    if (!myResponseIds.length) {
      return res.status(404).json({ error: '找不到此連線記錄' });
    }

    // Pass the Echo list id through — loadAuthorizedMatchPair tries listed + latest.
    // Prefer the id from the list row, then every owned submission (latest first).
    const candidateMyIds = [];
    if (requestedMyId && myResponseIds.includes(requestedMyId)) {
      candidateMyIds.push(requestedMyId);
    }
    for (const id of myResponseIds) {
      if (!candidateMyIds.includes(id)) candidateMyIds.push(id);
    }

    let pair = null;
    for (const myId of candidateMyIds) {
      pair = await loadAuthorizedMatchPair(
        admin,
        user.id,
        user.email,
        myId,
        partnerResponseId,
        myResponseIds,
        { deliveredOnly: !premium },
      );
      if (pair) break;
    }

    if (!pair) {
      return res.status(404).json({ error: '找不到此連線記錄' });
    }

    const { myRow, partnerRow, intelligence, match_score: score } = pair;
    const html = buildMatchCardHtml({
      user: myRow,
      target: partnerRow,
      score,
      intelligence,
      siteUrl: getSiteUrlFromRequest(req),
    });

    const myName = String(myRow.name || '神秘貓咪');
    const partnerName = String(partnerRow.name || '神秘貓咪');

    return res.status(200).json({
      html,
      match_score: score,
      title: `${myName} × ${partnerName}`,
    });
  } catch (err) {
    console.error('[matches/card]', err);
    return res.status(500).json({ error: 'Failed to generate match card' });
  }
}
