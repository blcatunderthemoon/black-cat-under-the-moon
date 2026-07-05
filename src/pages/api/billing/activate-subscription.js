/**
 * POST /api/billing/activate-subscription
 * After PayPal approval redirect, sync subscription status to DB.
 * Body: { subscription_id: string }
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import {
  getPayPalSubscription,
  syncPayPalSubscriptionToDb,
  isPayPalConfigured,
} from '../../../lib/paypal.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  if (!isPayPalConfigured()) {
    return res.status(503).json({ error: 'paypal_not_configured' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const subscriptionId = String(body.subscription_id || '').trim();
  if (!subscriptionId) {
    return res.status(400).json({ error: 'subscription_id required' });
  }

  try {
    const sub = await getPayPalSubscription(subscriptionId);
    if (!sub.custom_id || sub.custom_id !== user.id) {
      return res.status(403).json({ error: 'subscription_owner_mismatch' });
    }

    const result = await syncPayPalSubscriptionToDb(sub, { userId: user.id });
    return res.status(200).json({
      ok: true,
      status: result.status,
      premium: result.isPremium,
    });
  } catch (err) {
    console.error('[billing] activate-subscription error:', err.message || err);
    return res.status(500).json({ error: 'activation_failed' });
  }
}
