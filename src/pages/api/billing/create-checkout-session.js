/**
 * POST /api/billing/create-checkout-session
 * Creates a PayPal subscription approval link for Moonlight Passport.
 * Requires PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID.
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import {
  createPayPalSubscription,
  isPayPalConfigured,
} from '../../../lib/paypal.js';
import { getTrustedSiteOrigin } from '../../../lib/production-guard.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  if (!isPayPalConfigured()) {
    return res.status(503).json({
      error: 'paypal_not_configured',
      message: 'PayPal is not set up yet. Please use manual payment.',
    });
  }

  const origin = getTrustedSiteOrigin(req);

  try {
    const { subscriptionId, approvalUrl } = await createPayPalSubscription({
      userId: user.id,
      userEmail: user.email,
      returnUrl: `${origin}/billing/success?provider=paypal`,
      cancelUrl: `${origin}/premium`,
    });

    if (!approvalUrl) {
      return res.status(500).json({ error: 'paypal_no_approval_url' });
    }

    return res.status(200).json({
      url: approvalUrl,
      subscription_id: subscriptionId,
    });
  } catch (err) {
    console.error('[billing] PayPal checkout error:', err.message || err);
    return res.status(500).json({
      error: 'paypal_checkout_failed',
      message: err.message || '無法建立 PayPal 訂閱連結',
    });
  }
}
