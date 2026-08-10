/**
 * POST /api/dashboard/moonlight-interest-ack
 *
 * Admin tools for Moonlight Gathering #001 "application received" thank-you emails
 * (moonlight_interest participation form applicants).
 *
 * Body.action:
 *   preview      — list interested applicants (skip conduct_score = 0 when linked)
 *   create_batch — Gmail drafts (max 20)
 *   send_batch   — SMTP send (max 8, ~2s apart)
 *   send_one     — one manual test send
 *   create_one   — one manual draft
 *   mark_sent    — record emails as already drafted/sent (hide from preview)
 *
 * Auth: station dashboard key OR forum admin Bearer.
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
import {
  MOONLIGHT_ACK_SENT_OPS_KEY,
  filterCandidatesExcludingSent,
  loadMoonlightOutreachSentEmails,
  recordMoonlightOutreachSentEmails,
} from '../../../lib/moonlight-outreach-sent.js';

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

function normalizeEmailListCount(emails) {
  return new Set(
    (emails || [])
      .map((e) => normalizeEmail(e))
      .filter((e) => e && EMAIL_RE.test(e)),
  ).size;
}

function attendanceMessageSuffix(recorded) {
  const att = recorded?.attendance;
  if (!att?.ok) return '';
  return ` 月曆出席已更新為 ${att.approved}/${att.capacity}（仲有 ${att.seats_left} 個位）。`;
}

function parseIdList(body) {
  const raw = Array.isArray(body.application_ids)
    ? body.application_ids
    : Array.isArray(body.response_ids)
      ? body.response_ids
      : [];
  // moonlight_interest.id is UUID; keep string ids (also accept numeric if ever used).
  return [...new Set(
    raw
      .map((id) => String(id ?? '').trim())
      .filter((id) => id.length > 0 && id !== 'NaN'),
  )];
}

/**
 * Latest row wins per email. Prefer interest=interested.
 */
function dedupeApplicants(rows) {
  const byEmail = new Map();
  for (const row of rows || []) {
    const email = normalizeEmail(row.email);
    if (!email || !EMAIL_RE.test(email)) continue;
    const prev = byEmail.get(email);
    if (!prev || String(row.created_at || '') > String(prev.created_at || '')) {
      byEmail.set(email, row);
    }
  }
  return [...byEmail.values()].sort((a, b) => (
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  ));
}

async function loadConductBlockedUserIds(admin, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return new Set();
  const { data, error } = await admin
    .from('profiles')
    .select('id, conduct_score')
    .in('id', ids);
  if (error) {
    console.error('[moonlight-interest-ack] conduct lookup failed:', error.message);
    return new Set();
  }
  return new Set(
    (data || [])
      .filter((p) => Number(p.conduct_score) === 0)
      .map((p) => p.id),
  );
}

async function loadApplicantsPreview() {
  const admin = getAdminClient();
  const { data, error } = await fetchAllRows(() => admin
    .from('moonlight_interest')
    .select('id, email, display_name, telegram_username, interest, user_id, created_at')
    .eq('interest', 'interested')
    .not('email', 'is', null)
    .neq('email', '')
    .order('created_at', { ascending: false }));

  if (error) return { error, candidates: [], skipped_conduct_count: 0 };

  const deduped = dedupeApplicants(data);
  const blocked = await loadConductBlockedUserIds(
    admin,
    deduped.map((r) => r.user_id).filter(Boolean),
  );

  let skippedConduct = 0;
  const candidates = [];
  for (const row of deduped) {
    if (row.user_id && blocked.has(row.user_id)) {
      skippedConduct += 1;
      continue;
    }
    candidates.push({
      id: row.id,
      name: row.display_name || null,
      email: normalizeEmail(row.email),
      telegram: row.telegram_username || null,
      created_at: row.created_at,
    });
  }

  return { error: null, candidates, skipped_conduct_count: skippedConduct };
}

async function resolveApplicantsByIds(ids) {
  const admin = getAdminClient();
  const { data: rows, error } = await admin
    .from('moonlight_interest')
    .select('id, email, display_name, telegram_username, interest, user_id, created_at')
    .in('id', ids);
  if (error) return { error, recipients: [], skipped: [] };

  const blocked = await loadConductBlockedUserIds(
    admin,
    (rows || []).map((r) => r.user_id).filter(Boolean),
  );

  const byId = new Map((rows || []).map((r) => [String(r.id), r]));
  const skipped = [];
  const ordered = [];
  const seenEmail = new Set();

  for (const id of ids) {
    const row = byId.get(String(id));
    if (!row) {
      skipped.push({ id, reason: 'not_found' });
      continue;
    }
    if (row.interest !== 'interested') {
      skipped.push({ id, reason: 'not_interested' });
      continue;
    }
    if (row.user_id && blocked.has(row.user_id)) {
      skipped.push({ id, reason: 'conduct_zero' });
      continue;
    }
    const email = normalizeEmail(row.email);
    if (!email || !EMAIL_RE.test(email)) {
      skipped.push({ id, reason: 'no_email' });
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
  const admin = getAdminClient();

  if (action === 'preview') {
    const { error, candidates, skipped_conduct_count } = await loadApplicantsPreview();
    if (error) {
      console.error('[moonlight-interest-ack] preview failed:', error.message);
      const missing = /relation|does not exist|schema cache/i.test(error.message || '');
      return res.status(missing ? 503 : 500).json({
        error: missing
          ? 'moonlight_interest 表尚未建立，請先執行 migration。'
          : '無法讀取參加表申請人。',
      });
    }

    const sentEmails = await loadMoonlightOutreachSentEmails(admin, MOONLIGHT_ACK_SENT_OPS_KEY);
    const { visible, hidden } = filterCandidatesExcludingSent(candidates, sentEmails);

    return res.status(200).json({
      success: true,
      count: visible.length,
      hidden_already_sent: hidden,
      already_sent_total: sentEmails.length,
      candidates: visible,
      skipped_conduct_count,
    });
  }

  if (action === 'mark_sent') {
    const fromIds = parseIdList(body);
    const fromEmails = Array.isArray(body.emails) ? body.emails : [];
    let emails = [...fromEmails];
    if (fromIds.length) {
      const { error, recipients } = await resolveApplicantsByIds(fromIds);
      if (error) {
        return res.status(500).json({ error: '無法讀取選定嘅申請人。' });
      }
      emails = emails.concat(recipients.map((r) => r.email));
    }
    const recorded = await recordMoonlightOutreachSentEmails(
      admin,
      MOONLIGHT_ACK_SENT_OPS_KEY,
      emails,
    );
    if (!recorded.ok) {
      return res.status(503).json({ error: recorded.error });
    }
    return res.status(200).json({
      success: true,
      already_sent_total: recorded.emails.length,
      recorded_count: normalizeEmailListCount(emails),
      attendance: recorded.attendance || null,
      message:
        `已標記 ${normalizeEmailListCount(emails)} 個電郵為已處理，之後預覽唔會再出現。`
        + attendanceMessageSuffix(recorded),
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
      return res.status(500).json({ error: '無法讀取選定嘅申請人。' });
    }
    if (!recipients.length) {
      return res.status(400).json({ error: '選定嘅人冇有效電郵（或已被 conduct 略過）。' });
    }

    const results = [];
    let saved = 0;
    let failed = 0;
    for (const person of recipients) {
      const html = buildMoonlightApplicationAckHtml({ recipientName: person.name || undefined });
      const text = buildMoonlightApplicationAckText({ recipientName: person.name || undefined });
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

    const savedEmails = results.filter((r) => r.saved).map((r) => r.email);
    const recorded = await recordMoonlightOutreachSentEmails(
      admin,
      MOONLIGHT_ACK_SENT_OPS_KEY,
      savedEmails,
    );

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
      already_sent_total: recorded.ok ? recorded.emails.length : null,
      attendance: recorded.ok ? (recorded.attendance || null) : null,
      message:
        `已建立 ${saved} 封「已收到申請」Gmail 草稿（未發送）`
        + `${failed ? `，失敗 ${failed}` : ''}`
        + `${skipped.length ? `，略過 ${skipped.length}` : ''}。`
        + (recorded.ok
          ? ` 呢啲人已移出預覽名單。${attendanceMessageSuffix(recorded)}`
          : ` 草稿已建立，但未能記住名單：${recorded.error || '未知錯誤'}`),
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
      return res.status(500).json({ error: '無法讀取選定嘅申請人。' });
    }
    if (!recipients.length) {
      return res.status(400).json({ error: '選定嘅人冇有效電郵（或已被 conduct 略過）。' });
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

    const sentEmails = results.filter((r) => r.sent).map((r) => r.email);
    const recorded = await recordMoonlightOutreachSentEmails(
      admin,
      MOONLIGHT_ACK_SENT_OPS_KEY,
      sentEmails,
    );

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
      already_sent_total: recorded.ok ? recorded.emails.length : null,
      attendance: recorded.ok ? (recorded.attendance || null) : null,
      message:
        `已發送 ${sentCount} 封「已收到申請／感謝」電郵（每封間隔約 ${SEND_DELAY_MS / 1000} 秒）`
        + `${failed ? `，失敗 ${failed}` : ''}`
        + `${skipped.length ? `，略過 ${skipped.length}` : ''}。`
        + (recorded.ok
          ? ` 已寄出嘅人唔會再出現喺預覽名單。${attendanceMessageSuffix(recorded)}`
          : ` 已寄出，但未能記住名單：${recorded.error || '未知錯誤'}`),
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
        hint: '常見原因：Gmail 發送配額／App Password／SMTP 被擋。可隔幾分鐘再試。',
      });
    }

    return res.status(200).json({
      success: true,
      sent: true,
      mode: 'manual_send_one',
      to,
      subject,
      message: `已真正發送「已收到申請／感謝」測試電郵至 ${to}。請檢查收件箱／垃圾郵件。`,
    });
  }

  // create_one
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  const recipientName = typeof body.recipient_name === 'string' ? body.recipient_name.trim() : '';
  if (to && !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: '請輸入有效電郵（或留空，之後喺 Gmail 草稿自行填收件人）。' });
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
      ? `已存入「已收到申請／感謝」Gmail 草稿（收件人：${to}）。未發送。`
      : '已存入「已收到申請／感謝」Gmail 草稿（收件人留空）。未發送。',
  });
}
