/**
 * Persist Moonlight Gathering #001 outreach emails already drafted/sent
 * so they stay off the admin draft candidate list across sessions.
 *
 * Stored in ops_settings (same table as gathering card capacity).
 * Thank-you (ack) sent list also drives calendar attendance (approved / seats_left).
 */

import { normalizeEmailForPersonKey } from './response-dedupe.js';
import {
  loadMoonlightGathering001Config,
  saveMoonlightGathering001Config,
} from './moonlight-gathering-001.js';

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
 * Thank-you（參加表）已寄名單 → 月曆出席人數。
 * approved = unique ack emails（上限 capacity）；seats_left = capacity − approved.
 * @returns {{ ok: true, approved: number, seats_left: number, capacity: number, skipped?: boolean } | { ok: false, error: string }}
 */
export async function syncMoonlight001AttendanceFromAckSent(admin) {
  if (!admin) return { ok: false, error: 'No admin client' };
  try {
    const emails = await loadMoonlightOutreachSentEmails(admin, MOONLIGHT_ACK_SENT_OPS_KEY);
    const current = await loadMoonlightGathering001Config(admin);
    const capacity = current.capacity;
    const approved = Math.max(0, Math.min(capacity, emails.length));
    const seatsLeft = Math.max(0, capacity - approved);

    if (current.seats_left === seatsLeft) {
      return {
        ok: true,
        approved,
        seats_left: seatsLeft,
        capacity,
        skipped: true,
      };
    }

    const saved = await saveMoonlightGathering001Config(admin, {
      seats_left: seatsLeft,
      approved_count: approved,
    });
    if (!saved.ok) {
      return { ok: false, error: saved.error || '無法更新出席人數' };
    }
    return {
      ok: true,
      approved,
      seats_left: seatsLeft,
      capacity,
    };
  } catch (err) {
    console.warn('[moonlight-outreach] attendance sync failed:', err?.message || err);
    return { ok: false, error: err?.message || 'attendance sync failed' };
  }
}

/**
 * Merge emails into the persisted sent set.
 * When key is thank-you (ack), also refresh gathering #001 attendance.
 * @returns {{ ok: true, emails: string[], attendance?: object } | { ok: false, error: string }}
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

  /** @type {{ ok: true, emails: string[], attendance?: object }} */
  const result = { ok: true, emails: merged };
  if (key === MOONLIGHT_ACK_SENT_OPS_KEY) {
    const attendance = await syncMoonlight001AttendanceFromAckSent(admin);
    result.attendance = attendance;
  }
  return result;
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
