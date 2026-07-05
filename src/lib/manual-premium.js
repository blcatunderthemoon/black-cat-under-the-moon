/**
 * Manual Premium grant / revoke — shared by dashboard and billing APIs.
 */

import { getAdminClient, ensureProfile } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';

export async function applyManualPremiumAction({ user_id, action, days = 30, note = '' }) {
  const admin = getAdminClient();

  const { data: profile } = await admin.from('profiles').select('id').eq('id', user_id).maybeSingle();
  if (!profile) {
    const { data: { user }, error } = await admin.auth.admin.getUserById(user_id);
    if (error || !user) {
      return { ok: false, status: 404, error: 'User not found' };
    }
    await ensureProfile(user);
  }

  const now = new Date();

  if (action === 'grant') {
    const end = new Date(now);
    end.setDate(end.getDate() + Math.max(1, Math.min(365, Number(days) || 30)));

    const { error } = await admin
      .from('subscriptions')
      .upsert(
        {
          user_id,
          provider: 'manual',
          status: 'manual',
          current_period_start: databaseNowIso(now),
          current_period_end: end.toISOString(),
          updated_at: databaseNowIso(now),
        },
        { onConflict: 'user_id,provider' }
      );
    if (error) {
      return { ok: false, status: 500, error: 'Failed to grant premium: ' + error.message };
    }

    await admin
      .from('profiles')
      .update({ subscription_tier: 'premium', updated_at: databaseNowIso(now) })
      .eq('id', user_id);

    console.info(`[manual-premium] GRANT user_id=${user_id} days=${days} note="${note}"`);
    return { ok: true, action: 'grant', period_end: end.toISOString() };
  }

  const { error } = await admin
    .from('subscriptions')
    .update({ status: 'cancelled', current_period_end: databaseNowIso(), updated_at: databaseNowIso() })
    .eq('user_id', user_id)
    .in('status', ['manual', 'active']);

  if (error) {
    return { ok: false, status: 500, error: 'Failed to revoke premium: ' + error.message };
  }

  await admin
    .from('profiles')
    .update({ subscription_tier: 'free', updated_at: databaseNowIso() })
    .eq('id', user_id);

  console.info(`[manual-premium] REVOKE user_id=${user_id} note="${note}"`);
  return { ok: true, action: 'revoke' };
}
