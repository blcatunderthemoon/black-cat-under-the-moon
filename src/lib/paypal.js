/**
 * PayPal Subscriptions API helpers (Moonlight Passport).
 * Docs: docs/paypal-onboarding.md
 */

import { getAdminClient } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';
import { isProduction } from './production-guard.js';

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_BASE = 'https://api-m.paypal.com';

let cachedToken = null;
let tokenExpiresAt = 0;

export function isPayPalConfigured() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID
    && process.env.PAYPAL_CLIENT_SECRET
    && process.env.PAYPAL_PLAN_ID,
  );
}

export function getPayPalApiBase() {
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  return mode === 'live' ? LIVE_BASE : SANDBOX_BASE;
}

export function getPayPalManageUrl() {
  return process.env.PAYPAL_MANAGE_URL || 'https://www.paypal.com/myaccount/autopay/';
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error('paypal_not_configured');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.message || 'PayPal auth failed');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function paypalApi(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${getPayPalApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.name || `PayPal API ${res.status}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export async function createPayPalSubscription({ userId, userEmail, returnUrl, cancelUrl }) {
  const planId = process.env.PAYPAL_PLAN_ID;
  if (!planId) throw new Error('paypal_plan_missing');

  const payload = {
    plan_id: planId,
    custom_id: userId,
    subscriber: userEmail ? { email_address: userEmail } : undefined,
    application_context: {
      brand_name: 'Black Cat Under The Moon',
      locale: 'zh-HK',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
      },
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const data = await paypalApi('/v1/billing/subscriptions', {
    method: 'POST',
    body: payload,
  });

  const approveLink = (data.links || []).find((l) => l.rel === 'approve');
  return {
    subscriptionId: data.id,
    approvalUrl: approveLink?.href || null,
    status: data.status,
  };
}

export async function getPayPalSubscription(subscriptionId) {
  return paypalApi(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

function parsePeriod(sub) {
  const start = sub.start_time || sub.create_time || null;
  const end = sub.billing_info?.next_billing_time
    || sub.billing_info?.final_payment_time
    || null;
  return { start, end };
}

function mapPayPalStatus(status) {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'SUSPENDED':
      return 'past_due';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'cancelled';
    case 'APPROVAL_PENDING':
    case 'APPROVED':
      return 'pending';
    default:
      return 'pending';
  }
}

export async function syncPayPalSubscriptionToDb(sub, { userId: userIdOverride } = {}) {
  const admin = getAdminClient();
  const userId = userIdOverride || sub.custom_id;
  if (!userId) {
    throw new Error('missing_user_id');
  }

  const status = mapPayPalStatus(sub.status);
  const { start, end } = parsePeriod(sub);
  const payerId = sub.subscriber?.payer_id || null;

  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      provider: 'paypal',
      provider_customer_id: payerId,
      provider_subscription_id: sub.id,
      status,
      current_period_start: start,
      current_period_end: end,
      updated_at: databaseNowIso(),
    },
    { onConflict: 'user_id,provider' },
  );

  const isPremium = status === 'active' || status === 'past_due';
  await admin.from('profiles').update({
    subscription_tier: isPremium ? 'premium' : 'free',
    updated_at: databaseNowIso(),
  }).eq('id', userId);

  return { userId, status, isPremium };
}

export async function verifyPayPalWebhook(req, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    if (isProduction()) {
      console.error('[paypal] PAYPAL_WEBHOOK_ID required in production');
      return false;
    }
    console.warn('[paypal] PAYPAL_WEBHOOK_ID not set — skipping signature verify (dev only)');
    return true;
  }

  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const certUrl = req.headers['paypal-cert-url'];
  const authAlgo = req.headers['paypal-auth-algo'];
  const transmissionSig = req.headers['paypal-transmission-sig'];

  if (!transmissionId || !transmissionSig) {
    return false;
  }

  const result = await paypalApi('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    },
  });

  return result.verification_status === 'SUCCESS';
}

export function subscriptionIdFromWebhook(event) {
  const resource = event.resource || {};
  if (resource.billing_agreement_id) return resource.billing_agreement_id;
  if (resource.id && String(resource.id).startsWith('I-')) return resource.id;
  return null;
}
