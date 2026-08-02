/**
 * Persist Moonlight Gathering #001 outreach emails already drafted/sent
 * so they stay off the admin draft candidate list across sessions.
 *
 * Stored in ops_settings (same table as gathering card capacity).
 */

import { normalizeEmailForPersonKey } from './response-dedupe.js';

export const MOONLIGHT_INVITE_SENT_OPS_KEY = 'moonlight_gathering_001_invite_sent';
export const MOONLIGHT_ACK_SENT_OPS_KEY = 'moonlight_gathering_001_ack_sent';

function normalizeEmailList(raw) {
  const out = new Set();
  for (const item of raw || []) {
    const n = normalizeEmailForPersonKey(item) || String(item || '').toLowerCase().trim();
    if (n && n.includes('@')) out.add(n);
  }
  return [...out].sort();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} key
 * @returns {Promise<string[]>}
 */
export async function loadMoonlightOutreachSentEmails(admin, key) {
  if (!admin || !key) return [];
  try {
    const { data, error } = await admin
      .from('ops_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) {
      console.warn('[moonlight-outreach] load sent:', error.message, error.code);
      return [];
    }
    const emails = data?.value?.emails;
    return normalizeEmailList(Array.isArray(emails) ? emails : []);
  } catch (err) {
    console.warn('[moonlight-outreach] load sent failed:', err?.message || err);
    return [];
  }
}

/**
 * Merge emails into the persisted sent set.
 * @returns {{ ok: true, emails: string[] } | { ok: false, error: string }}
 */
export async function recordMoonlightOutreachSentEmails(admin, key, emailsToAdd) {
  const incoming = normalizeEmailList(emailsToAdd);
  if (!incoming.length) {
    const existing = await loadMoonlightOutreachSentEmails(admin, key);
    return { ok: true, emails: existing };
  }

  const existing = await loadMoonlightOutreachSentEmails(admin, key);
  const merged = normalizeEmailList([...existing, ...incoming]);

  const { error } = await admin
    .from('ops_settings')
    .upsert(
      {
        key,
        value: {
          emails: merged,
          updated_at: new Date().toISOString(),
          count: merged.length,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );

  if (error) {
    const missing = /ops_settings|schema cache|does not exist/i.test(error.message || '');
    return {
      ok: false,
      error: missing
        ? '尚未建立 ops_settings 表，請先執行 scripts/sql/ops-settings.sql'
        : (error.message || '無法記錄已寄電郵'),
    };
  }
  return { ok: true, emails: merged };
}

export function filterCandidatesExcludingSent(candidates, sentEmails) {
  const sent = new Set(normalizeEmailList(sentEmails));
  if (!sent.size) {
    return { visible: candidates || [], hidden: 0 };
  }
  const visible = [];
  let hidden = 0;
  for (const c of candidates || []) {
    const email = normalizeEmailForPersonKey(c.email) || String(c.email || '').toLowerCase().trim();
    if (email && sent.has(email)) {
      hidden += 1;
      continue;
    }
    visible.push(c);
  }
  return { visible, hidden };
}
