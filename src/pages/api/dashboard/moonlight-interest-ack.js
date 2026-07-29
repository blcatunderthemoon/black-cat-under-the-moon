/**
 * POST /api/dashboard/moonlight-interest-ack
 *
 * Admin: draft / send "application received" emails to moonlight_interest rows.
 *
 * Body.action:
 *   preview      — list applicants with email (deduped)
 *   create_batch — Gmail drafts (max 20)
 *   send_batch   — SMTP send (max 8, ~2s apart)
 *   send_one     — SMTP one test email
 *   create_one   — one Gmail draft
 *
 * Auth: station dashboard key OR forum admin Bearer.
 * Skips linked profiles with conduct_score === 0.
 */

import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';
import { getAdminClient } from '../../../lib/server-auth.js';
import { fetchAllRows } from '../../../lib/supabase-fetch-all.js';
import { appendGmailDraft, isGmailDraftConfigured } from '../../../lib/gmail-imap-draft.js';
import { getGmailTransporter } from '../../../lib/gmail-smtp.js';
import {
  buildMoonlightApplicationAckHtml,
  buildMoonlightApplicationAckSubject,
  buildMoonlightApplicationAckText,
} from '../../../lib/moonlight-interest-email.js';

export const config = {
  maxDuration: 60,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 40;
const MAX_DRAFT_BATCH = 20;
const MAX_SEND_BATCH = 8;
const SEND_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseIdList(body) {
  return Array.isArray(body.application_ids)
    ? [...new Set(body.application_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
}

async function loadBlockedEmailsByConduct(admin, rows) {
  const userIds = [...new Set(
    (rows || [])
      .map((r) => r.user_id)
      .filter((id) => typeof id === 'string' && id.length > 0),
  )];
  if (!userIds.length) return new Set();

  const { data, error } = await admin
    .from('profiles')
    .select('id, conduct_score')
    .in('id', userIds);
  if (error) {
    console.error('[moonlight-interest-ack] conduct lookup failed:', error.message);
    return new Set();
  }

  const blockedUserIds = new Set(
    (data || [])
      .filter((p) => p.conduct_score != null && Number(p.conduct_score) === 0)
      .map((p) => p.id),
  );
  if (!blockedUserIds.size) return new Set();

  const blockedEmails = new Set();
  for (const row of rows || []) {
    if (!blockedUserIds.has(row.user_id)) continue;
    const email = normalizeEmail(row.email);
    if (email) blockedEmails.add(email);
  }
  return blockedEmails;
}

function dedupeApplicants(rows, blockedEmails) {
  const byEmail = new Map();
  const skippedConduct = [];
  for (const row of rows || []) {
    const email = normalizeEmail(row.email);
    if (!email || !EMAIL_RE.test(email)) continue;
    if (blockedEmails.has(email)) {
      skippedConduct.push({ id: Number(row.id), email, reason: 'conduct_score_0' });
      continue;
    }
    const prev = byEmail.get(email);
    const id = Number(row.id);
    if (!prev || id > prev.id) {
      byEmail.set(email, {
        id,
        email,
        name: row.display_name || null,
        telegram: row.telegram_username || null,
        created_at: row.created_at || null,
      });
    }
  }
  return {
    candidates: [...byEmail.values()].sort((a, b) => b.id - a.id),
    skippedConduct,
  };
}

async function loadApplicants() {
  const admin = getAdminClient();
  const { data, error } = await fetchAllRows(() => admin
    .from('moonlight_interest')
    .select('id, email, display_name, telegram_username, user_id, created_at')
    .not('email', 'is', null)
    .neq('email', '')
    .order('id', { ascending: false }));
  if (error) return { error, candidates: [], skippedConduct: [] };

  const blockedEmails = await loadBlockedEmailsByConduct(admin, data || []);
  const { candidates, skippedConduct } = dedupeApplicants(data || [], blockedEmails);
  return { error: null, candidates, skippedConduct };
}

async function resolveApplicantsByIds(ids) {
  const admin = getAdminClient();
  const { data: rows, error } = await admin
    .from('moonlight_interest')
    .select('id, email, display_name, telegram_username, user_id, created_at')
    .in('id', ids);
  if (error) return { error, recipients: [], skipped: [] };

  const blockedEmails = await loadBlockedEmailsByConduct(admin, rows || []);
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
    const email = normalizeEmail(row.email);
    if (!email || !EMAIL_RE.test(email)) {
      skipped.push({ id, reason: 'no_email' });
      continue;
    }
    if (blockedEmails.has(email)) {
      skipped.push({ id, email, reason: 'conduct_score_0' });
      continue;
    }
    if (seenEmail.has(email)) {
      skipped.push({ id, reason: 'duplicate_email' });
      continue;
    }
    seenEmail.add(email);
    ordered.push({
      id,
      email,
      name: row.display_name || null,
    });
  }

  return { error: null, recipients: ordered, skipped };
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
    const { error, candidates, skippedConduct } = await loadApplicants();
    if (error) {
      console.error('[moonlight-interest-ack] preview failed:', error.message);
      return res.status(500).json({ error: '無法讀取參加表申請。' });
    }
    return res.status(200).json({
      success: true,
      count: candidates.length,
      candidates,
      skipped_conduct_count: skippedConduct.length,
      skipped_conduct: skippedConduct.slice(0, 50),
    });
  }

  if (!isGmailDraftConfigured()) {
    return res.status(503).json({
      error: 'Gmail not configured.',
      hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart.',
    });
  }

  const subject = buildMoonlightApplicationAckSubject();

  if (action === 'create_batch') {
    const ids = parseIdList(body);
    if (!ids.length) return res.status(400).json({ error: '請選擇至少一位申請人。' });
    if (ids.length > MAX_DRAFT_BATCH) {
      return res.status(400).json({
        error: `一次最多建立 ${MAX_DRAFT_BATCH} 封獨立草稿，請分批撳。`,
        max_batch: MAX_DRAFT_BATCH,
      });
    }

    const { error, recipients, skipped } = await resolveApplicantsByIds(ids);
    if (error) {
      console.error('[moonlight-interest-ack] batch load failed:', error.message);
      return res.status(500).json({ error: '無法讀取選定嘅申請。' });
    }
    if (!recipients.length) {
      return res.status(400).json({ error: '選定嘅人冇有效電郵（或 conduct_score=0 已略過）。' });
    }

    const results = [];
    let saved = 0;
    let failed = 0;
    for (const person of recipients) {
      const html = buildMoonlightApplicationAckHtml({ recipientName: person.name || undefined });
      const text = buildMoonlightApplicationAckText({ recipientName: person.name || undefined });
      const result = await appendGmailDraft({ to: person.email, subject, html, text });
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
      mode: 'application_ack_drafts',
      saved,
      failed,
      skipped_count: skipped.length,
      skipped,
      results,
      message:
        `已建立 ${saved} 封「已收到申請」草稿`
        + `${failed ? `，失敗 ${failed}` : ''}`
        + `${skipped.length ? `，略過 ${skipped.length}` : ''}。`,
    });
  }

  if (action === 'send_batch') {
    const ids = parseIdList(body);
    if (!ids.length) return res.status(400).json({ error: '請選擇至少一位申請人。' });
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

    const { error, recipients, skipped } = await resolveApplicantsByIds(ids);
    if (error) {
      console.error('[moonlight-interest-ack] send load failed:', error.message);
      return res.status(500).json({ error: '無法讀取選定嘅申請。' });
    }
    if (!recipients.length) {
      return res.status(400).json({ error: '選定嘅人冇有效電郵（或 conduct_score=0 已略過）。' });
    }

    const from = `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`;
    const results = [];
    let sentCount = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += 1) {
      const person = recipients[i];
      if (i > 0) await sleep(SEND_DELAY_MS);
      const html = buildMoonlightApplicationAckHtml({ recipientName: person.name || undefined });
      const text = buildMoonlightApplicationAckText({ recipientName: person.name || undefined });
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
        console.error('[moonlight-interest-ack] send failed:', person.email, err.message);
        results.push({ id: person.id, email: person.email, sent: false, error: err.message });
        failed += 1;
      }
    }

    return res.status(200).json({
      success: true,
      sent: true,
      mode: 'application_ack_send',
      sent_count: sentCount,
      failed,
      skipped_count: skipped.length,
      skipped,
      delay_ms: SEND_DELAY_MS,
      max_batch: MAX_SEND_BATCH,
      results,
      message:
        `已發送 ${sentCount} 封「已收到申請」電郵`
        + `${failed ? `，失敗 ${failed}` : ''}`
        + `${skipped.length ? `，略過 ${skipped.length}` : ''}。`
        + ' 若仲有人，請隔 1–2 分鐘再撳下一批。',
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

    const html = buildMoonlightApplicationAckHtml({ recipientName: recipientName || undefined });
    const text = buildMoonlightApplicationAckText({ recipientName: recipientName || undefined });
    const from = `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`;

    try {
      await transporter.sendMail({ from, to, subject, html, text });
    } catch (err) {
      console.error('[moonlight-interest-ack] send_one failed:', to, err.message);
      return res.status(502).json({
        error: err.message || '測試發送失敗',
        hint: '常見原因：Gmail 發送配額／App Password／SMTP 被擋。',
      });
    }

    return res.status(200).json({
      success: true,
      sent: true,
      mode: 'application_ack_send_one',
      to,
      subject,
      message: `已真正發送「已收到申請」測試電郵至 ${to}。`,
    });
  }

  // create_one
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  const recipientName = typeof body.recipient_name === 'string' ? body.recipient_name.trim() : '';
  if (to && !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: '請輸入有效電郵（或留空）。' });
  }
  if (recipientName.length > MAX_NAME) {
    return res.status(400).json({ error: `稱呼不能超過 ${MAX_NAME} 字。` });
  }

  const html = buildMoonlightApplicationAckHtml({ recipientName: recipientName || undefined });
  const text = buildMoonlightApplicationAckText({ recipientName: recipientName || undefined });
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
      ? `已存入「已收到申請」Gmail 草稿（收件人：${to}）。`
      : '已存入「已收到申請」Gmail 草稿（收件人留空）。',
  });
}
