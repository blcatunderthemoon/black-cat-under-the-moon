/**
 * POST /api/billing/create-portal-session
 * PayPal subscription management — opens PayPal auto-pay settings.
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { getPayPalManageUrl, isPayPalConfigured } from '../../../lib/paypal.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  if (!isPayPalConfigured()) {
    return res.status(503).json({ error: 'paypal_not_configured' });
  }

  return res.status(200).json({ url: getPayPalManageUrl() });
}
