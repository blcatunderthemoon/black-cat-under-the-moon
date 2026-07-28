/**
 * POST /api/dashboard/moonlight-interest-draft
 *
 * Admin tools for Moonlight Gathering interest-survey emails.
 *
 * Body.action:
 *   preview      — filter responses by identity + age → candidate list
 *   create_batch — individual Gmail drafts (1 per person, max 20 / request)
 *   send_batch   — SMTP send individually with delay (max 8 / request, ~2s apart)
 *   send_one     — SMTP send one manual test email (to + optional recipient_name)
 *   create_one   — single manual draft (optional to / recipient_name)
 *
 * Auth: station dashboard key OR forum admin Bearer.
 */

import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';
import { getAdminClient } from '../../../lib/server-auth.js';
import { fetchAllRows } from '../../../lib/supabase-fetch-all.js';
import { appendGmailDraft, isGmailDraftConfigured } from '../../../lib/gmail-imap-draft.js';
import { getGmailTransporter } from '../../../lib/gmail-smtp.js';
import {
  buildMoonlightInterestEmailHtml,
  buildMoonlightInterestEmailSubject,
  buildMoonlightInterestEmailText,
} from '../../../lib/moonlight-interest-email.js';
import { getSiteUrlFromRequest } from '../../../lib/site-seo.js';

export const config = {
  maxDuration: 60,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 40;
const MAX_DRAFT_BATCH = 20;
const MAX_SEND_BATCH = 8;
const SEND_DELAY_MS = 2000;
const IDENTITY_OPTIONS = new Set(['TB', 'TBG', 'Pure', 'Bi', 'No Label', '仲探索緊']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

function parseIdentities(body) {
  const raw = Array.isArray(body.identities)
    ? body.identities
    : typeof body.identity === 'string'
      ? [body.identity]
      : [];
  return [...new Set(
    raw
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => IDENTITY_OPTIONS.has(v)),
  )];
}

function parseAgeBound(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 18 || i > 60) return null;
  return i;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Latest response wins per normalized_email.
 */
function dedupeByEmail(rows) {
  const byEmail = new Map();
  for (const row of rows || []) {
    const email = normalizeEmail(row.normalized_email || row.email);
    if (!email || !EMAIL_RE.test(email)) continue;
    const prev = byEmail.get(email);
    if (!prev || Number(row.id) > Number(prev.id)) {
      byEmail.set(email, {
        id: Number(row.id),
        name: row.name || null,
        email,
        identity: row.identity || null,
        age: row.age == null ? null : Number(row.age),
      });
    }
  }
  return [...byEmail.values()].sort((a, b) => b.id - a.id);
}

function parseIdList(body) {
  return Array.isArray(body.response_ids)
    ? [...new Set(body.response_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
}

async function resolveRecipientsByIds(ids) {
  const admin = getAdminClient();
  const { data: rows, error } = await admin
    .from('responses')
    .select('id, name, email, normalized_email, identity, age')
    .in('id', ids);
  if (error) return { error, recipients: [], skipped: [] };

  const byId = new Map((rows || []).map((r) => [Number(r.id), r]));
  const skipped = [];
  const ordered = [];
  const seenEmail = new Set();

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      skipped.push({ id, reason: 'not_found' });
      continue;
    }
    const email = normalizeEmail(row.normalized_email || row.email);
    if (!email || !EMAIL_RE.test(email)) {
      skipped.push({ id, reason: 'no_email' });
      continue;
    }
    if (seenEmail.has(email)) {
      skipped.push({ id, reason: 'duplicate_email' });
      continue;
    }
    seenEmail.add(email);
    ordered.push({ id, email, name: row.name || null });
  }

  return { error: null, recipients: ordered, skipped };
}

async function loadFilteredCandidates({ identities, ageMin, ageMax }) {
  const admin = getAdminClient();
  const { data, error } = await fetchAllRows(() => {
    let q = admin
      .from('responses')
      .select('id, name, email, normalized_email, identity, age')
      .not('email', 'is', null)
      .neq('email', '');
    if (identities.length) q = q.in('identity', identities);
    if (ageMin != null) q = q.gte('age', ageMin);
    if (ageMax != null) q = q.lte('age', ageMax);
    return q.order('id', { ascending: false });
  });
  if (error) return { error, candidates: [] };
  return { error: null, candidates: dedupeByEmail(data) };
}

export default async function handler(req, res) {
  if (!(await authorizeStationOrForumAdmin(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body;
  try {
    body = parseBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const action = typeof body.action === 'string' ? body.action.trim() : 'create_one';

  if (action === 'preview') {
    const identities = parseIdentities(body);
    const ageMin = parseAgeBound(body.age_min, null);
    const ageMax = parseAgeBound(body.age_max, null);
    if (body.age_min != null && body.age_min !== '' && ageMin == null) {
      return res.status(400).json({ error: 'age_min 無效（18–60）。' });
    }
    if (body.age_max != null && body.age_max !== '' && ageMax == null) {
      return res.status(400).json({ error: 'age_max 無效（18–60）。' });
    }
    if (ageMin != null && ageMax != null && ageMin > ageMax) {
      return res.status(400).json({ error: '年齡下限不能大於上限。' });
    }

    const { error, candidates } = await loadFilteredCandidates({ identities, ageMin, ageMax });
    if (error) {
      console.error('[moonlight-interest-draft] preview failed:', error.message);
      return res.status(500).json({ error: '無法讀取 responses。' });
    }

    return res.status(200).json({
      success: true,
      filters: { identities, age_min: ageMin, age_max: ageMax },
      count: candidates.length,
      candidates,
      identity_options: [...IDENTITY_OPTIONS],
    });
  }

  if (!isGmailDraftConfigured()) {
    return res.status(503).json({
      error: 'Gmail not configured.',
      hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart.',
    });
  }

  const siteUrl = getSiteUrlFromRequest(req);

  if (action === 'create_batch') {
    const ids = parseIdList(body);
    if (!ids.length) {
      return res.status(400).json({ error: '請選擇至少一位收件人。' });
    }
    if (ids.length > MAX_DRAFT_BATCH) {
      return res.status(400).json({
        error: `一次最多建立 ${MAX_DRAFT_BATCH} 封獨立草稿，請分批撳。`,
        max_batch: MAX_DRAFT_BATCH,
      });
    }

    const { error, recipients, skipped } = await resolveRecipientsByIds(ids);
    if (error) {
      console.error('[moonlight-interest-draft] batch load failed:', error.message);
      return res.status(500).json({ error: '無法讀取選定嘅 responses。' });
    }
    if (!recipients.length) {
      return res.status(400).json({ error: '選定嘅人冇有效電郵。' });
    }

    const subject = buildMoonlightInterestEmailSubject();
    const results = [];
    let saved = 0;
    let failed = 0;

    for (const person of recipients) {
      const html = buildMoonlightInterestEmailHtml({
        siteUrl,
        recipientName: person.name || undefined,
      });
      const text = buildMoonlightInterestEmailText({
        siteUrl,
        recipientName: person.name || undefined,
      });
      const result = await appendGmailDraft({
        to: person.email,
        subject,
        html,
        text,
      });
      if (result.ok) {
        results.push({ id: person.id, email: person.email, saved: true });
        saved += 1;
      } else {
        results.push({ id: person.id, email: person.email, saved: false, error: result.error });
        failed += 1;
      }
    }

    return res.status(200).json({
      success: true,
      sent: false,
      mode: 'individual_drafts',
      saved,
      failed,
      skipped_count: skipped.length,
      skipped,
      max_batch: MAX_DRAFT_BATCH,
      results,
      message:
        `已建立 ${saved} 封獨立 Gmail 草稿（未發送）`
        + `${failed ? `，失敗 ${failed}` : ''}`
        + `${skipped.length ? `，略過 ${skipped.length}` : ''}。`
        + '請喺 Gmail「草稿」逐封檢查後寄出；建議唔好一次過狂寄。',
    });
  }

  if (action === 'send_batch') {
    const ids = parseIdList(body);
    if (!ids.length) {
      return res.status(400).json({ error: '請選擇至少一位收件人。' });
    }
    if (ids.length > MAX_SEND_BATCH) {
      return res.status(400).json({
        error: `一次最多發送 ${MAX_SEND_BATCH} 封，請隔開時間再撳下一批。`,
        max_batch: MAX_SEND_BATCH,
        delay_ms: SEND_DELAY_MS,
      });
    }

    const transporter = getGmailTransporter();
    if (!transporter) {
      return res.status(503).json({
        error: 'Gmail SMTP not configured.',
        hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart.',
      });
    }

    const { error, recipients, skipped } = await resolveRecipientsByIds(ids);
    if (error) {
      console.error('[moonlight-interest-draft] send load failed:', error.message);
      return res.status(500).json({ error: '無法讀取選定嘅 responses。' });
    }
    if (!recipients.length) {
      return res.status(400).json({ error: '選定嘅人冇有效電郵。' });
    }

    const subject = buildMoonlightInterestEmailSubject();
    const from = `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`;
    const results = [];
    let sentCount = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += 1) {
      const person = recipients[i];
      if (i > 0) await sleep(SEND_DELAY_MS);

      const html = buildMoonlightInterestEmailHtml({
        siteUrl,
        recipientName: person.name || undefined,
      });
      const text = buildMoonlightInterestEmailText({
        siteUrl,
        recipientName: person.name || undefined,
      });

      try {
        await transporter.sendMail({
          from,
          to: person.email,
          subject,
          html,
          text,
        });
        results.push({ id: person.id, email: person.email, sent: true });
        sentCount += 1;
      } catch (err) {
        console.error('[moonlight-interest-draft] send failed:', person.email, err.message);
        results.push({ id: person.id, email: person.email, sent: false, error: err.message });
        failed += 1;
      }
    }

    return res.status(200).json({
      success: true,
      sent: true,
      mode: 'individual_send',
      sent_count: sentCount,
      failed,
      skipped_count: skipped.length,
      skipped,
      delay_ms: SEND_DELAY_MS,
      max_batch: MAX_SEND_BATCH,
      processed_ids: results.filter((r) => r.sent).map((r) => r.id),
      results,
      message:
        `已分批發送 ${sentCount} 封（每封間隔約 ${SEND_DELAY_MS / 1000} 秒）`
        + `${failed ? `，失敗 ${failed}` : ''}`
        + `${skipped.length ? `，略過 ${skipped.length}` : ''}。`
        + ' 若仲有人，請隔幾分鐘再撳下一批。',
    });
  }

  if (action === 'send_one') {
    const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
    const recipientName = typeof body.recipient_name === 'string' ? body.recipient_name.trim() : '';

    if (!to || !EMAIL_RE.test(to)) {
      return res.status(400).json({ error: '請輸入有效測試電郵。' });
    }
    if (recipientName.length > MAX_NAME) {
      return res.status(400).json({ error: `稱呼不能超過 ${MAX_NAME} 字。` });
    }

    const transporter = getGmailTransporter();
    if (!transporter) {
      return res.status(503).json({
        error: 'Gmail SMTP not configured.',
        hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart.',
      });
    }

    const subject = buildMoonlightInterestEmailSubject();
    const html = buildMoonlightInterestEmailHtml({
      siteUrl,
      recipientName: recipientName || undefined,
    });
    const text = buildMoonlightInterestEmailText({
      siteUrl,
      recipientName: recipientName || undefined,
    });
    const from = `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`;

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      });
    } catch (err) {
      console.error('[moonlight-interest-draft] send_one failed:', to, err.message);
      return res.status(502).json({
        error: err.message || '測試發送失敗',
        hint: '常見原因：Gmail 發送配額／App Password／SMTP 被擋。可隔幾分鐘再試。',
      });
    }

    return res.status(200).json({
      success: true,
      sent: true,
      mode: 'manual_send_one',
      to,
      subject,
      message: `已真正發送測試邀請電郵至 ${to}。請檢查收件箱／垃圾郵件。`,
    });
  }

  // create_one (default)
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  const recipientName = typeof body.recipient_name === 'string' ? body.recipient_name.trim() : '';

  if (to && !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: '請輸入有效電郵（或留空，之後喺 Gmail 草稿自行填收件人）。' });
  }
  if (recipientName.length > MAX_NAME) {
    return res.status(400).json({ error: `稱呼不能超過 ${MAX_NAME} 字。` });
  }

  const subject = buildMoonlightInterestEmailSubject();
  const html = buildMoonlightInterestEmailHtml({
    siteUrl,
    recipientName: recipientName || undefined,
  });
  const text = buildMoonlightInterestEmailText({
    siteUrl,
    recipientName: recipientName || undefined,
  });
  const result = await appendGmailDraft({
    to: to || undefined,
    subject,
    html,
    text,
  });

  if (!result.ok) {
    return res.status(500).json({
      error: result.error || '無法建立 Gmail 草稿。',
      hint: result.hint,
    });
  }

  return res.status(200).json({
    success: true,
    sent: false,
    draftsPath: result.draftsPath,
    subject,
    to: to || null,
    message: to
      ? `已存入 Gmail 草稿（收件人：${to}）。未發送，請喺 Gmail「草稿」檢查後自行寄出。`
      : '已存入 Gmail 草稿（收件人留空）。未發送，請喺 Gmail「草稿」填收件人後自行寄出。',
  });
}
