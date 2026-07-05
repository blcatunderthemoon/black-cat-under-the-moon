/**
 * GET /api/billing/config — public billing UI flags (no auth).
 */

import { isPayPalConfigured } from '../../../lib/paypal.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  return res.status(200).json({
    paypal_configured: isPayPalConfigured(),
  });
}
