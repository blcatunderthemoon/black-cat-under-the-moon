/**
 * GET /api/billing/status
 * Returns current user's subscription status.
 */

import { requireUser, sendAuthError, getSubscriptionTier, getAdminClient } from '../../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const admin = getAdminClient();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, provider, status, current_period_start, current_period_end, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const tier = await getSubscriptionTier(user.id);

  // Load quota usage for the current period
  const now = new Date();
  const { data: quotas } = await admin
    .from('usage_quotas')
    .select('quota_type, used_count, limit_count, period_end')
    .eq('user_id', user.id)
    .lte('period_start', now.toISOString())
    .gte('period_end', now.toISOString());

  const quotaMap = {};
  (quotas || []).forEach((q) => { quotaMap[q.quota_type] = { used: q.used_count, limit: q.limit_count, period_end: q.period_end }; });

  return res.status(200).json({
    tier,
    subscription: sub
      ? {
          id: sub.id,
          provider: sub.provider,
          status: sub.status,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
        }
      : null,
    quotas: quotaMap,
  });
}
