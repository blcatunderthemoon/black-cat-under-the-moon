/**
 * POST /api/billing/webhook
 * PayPal webhook endpoint.
 *
 * Handles:
 *   BILLING.SUBSCRIPTION.ACTIVATED  → grant Moonlight Passport
 *   BILLING.SUBSCRIPTION.UPDATED    → refresh period / status
 *   PAYMENT.SALE.COMPLETED          → extend billing period on renewal
 *   BILLING.SUBSCRIPTION.CANCELLED  → revert to free at period end
 *   BILLING.SUBSCRIPTION.SUSPENDED  → mark past_due
 *   BILLING.SUBSCRIPTION.EXPIRED    → cancel
 *
 * Requires PAYPAL_WEBHOOK_ID for signature verification (recommended in production).
 */

import {
  getPayPalSubscription,
  syncPayPalSubscriptionToDb,
  verifyPayPalWebhook,
  subscriptionIdFromWebhook,
} from '../../../lib/paypal.js';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const HANDLED_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'PAYMENT.SALE.COMPLETED',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await getRawBody(req);
  const bodyText = rawBody.toString('utf8');

  let event;
  try {
    event = JSON.parse(bodyText);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    const verified = await verifyPayPalWebhook(req, bodyText);
    if (!verified) {
      return res.status(400).json({ error: 'Webhook signature invalid' });
    }
  } catch (err) {
    console.error('[paypal webhook] verify error:', err.message || err);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  if (!HANDLED_EVENTS.has(event.event_type)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const subscriptionId = subscriptionIdFromWebhook(event);
    if (!subscriptionId) {
      return res.status(200).json({ received: true, skipped: 'no_subscription_id' });
    }

    const sub = await getPayPalSubscription(subscriptionId);
    await syncPayPalSubscriptionToDb(sub);
  } catch (err) {
    console.error('[paypal webhook] handler error:', err.message || err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  return res.status(200).json({ received: true });
}
