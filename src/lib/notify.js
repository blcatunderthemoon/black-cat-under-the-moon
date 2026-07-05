/**
 * src/lib/notify.js
 * Send email notifications for inbox events.
 *
 * Uses the existing nodemailer / SMTP setup (GMAIL_USER + GMAIL_APP_PASSWORD).
 * Fires silently — never throws; only logs errors.
 *
 * Env vars used:
 *   GMAIL_USER           — sender SMTP address
 *   GMAIL_APP_PASSWORD   — Gmail app password (or SMTP password)
 *   NEXT_PUBLIC_SITE_URL — base URL for deep-links (optional, falls back)
 *
 * Privacy rules:
 *   - Emails must NOT reveal other users' email, user ID, or detailed match data.
 *   - Only basic "you have a new message" with a link to the inbox.
 */

import nodemailer from 'nodemailer';
import { getAdminClient } from './server-auth.js';
import { getSiteUrl, getSiteHost } from './site-seo.js';

const SITE_URL = getSiteUrl();
const SITE_HOST = getSiteHost();

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user, pass } });
}

/**
 * Build minimal notification email HTML.
 */
function buildNotificationHtml({ title, body, cta, ctaUrl }) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#07060e;margin:0;padding:24px 12px;font-family:'Noto Sans TC',Arial,sans-serif;">
  <div style="max-width:500px;margin:0 auto;background:#131128;border:1px solid rgba(124,92,252,0.25);border-radius:14px;padding:32px 28px;">
    <div style="font-size:28px;text-align:center;margin-bottom:16px;">🌙</div>
    <h2 style="font-size:18px;font-weight:800;color:#e8e3f5;margin:0 0 10px;text-align:center;">${title}</h2>
    <p style="font-size:14px;color:#9490b0;line-height:1.8;text-align:center;margin:0 0 24px;">${body}</p>
    <div style="text-align:center;">
      <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;border-radius:8px;background:linear-gradient(135deg,#7c5cfc,#5b8af0);color:#fff;font-weight:700;font-size:14px;text-decoration:none;">${cta}</a>
    </div>
    <p style="font-size:11px;color:#5e5a78;text-align:center;margin-top:20px;">
      Black Cat Under The Moon · <a href="${SITE_URL}" style="color:#7c5cfc;">${SITE_HOST}</a>
    </p>
  </div>
</body></html>`;
}

/**
 * Send a notification email to a user.
 * Looks up the user's auth email from Supabase.
 * Silently skips if email can't be found or SMTP is not configured.
 *
 * @param {string} userId  — profiles.id / auth.users.id
 * @param {{ subject, title, body, cta, ctaUrl }} options
 */
export async function sendInboxNotification(userId, { subject, title, body, cta, ctaUrl, prefKey }) {
  const transporter = getTransporter();
  if (!transporter) return; // SMTP not configured — skip silently

  try {
    const admin = getAdminClient();

    // Check notification preferences before sending
    if (prefKey) {
      const { data: profile } = await admin
        .from('profiles')
        .select('notification_prefs')
        .eq('id', userId)
        .maybeSingle();
      const prefs = profile?.notification_prefs || {};
      // Default to true; only skip if explicitly set false
      if (prefs[prefKey] === false) return;
    }

    // Fetch auth email via admin auth API
    const { data: { user }, error } = await admin.auth.admin.getUserById(userId);
    if (error || !user?.email) return;
    if (!user.email_confirmed_at) return; // don't email unverified accounts

    const html = buildNotificationHtml({ title, body, cta, ctaUrl });
    await transporter.sendMail({
      from: `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject,
      html,
    });
  } catch (err) {
    console.error('[notify] sendInboxNotification failed:', err?.message);
  }
}

/**
 * Notify a user that they received a match card.
 * Called after deliverMatchCard succeeds.
 */
export async function notifyMatchCard(userId, { matchScore }) {
  await sendInboxNotification(userId, {
    subject: '🌙 你有一張新的共鳴分析卡！',
    title: '共鳴分析卡已送達',
    body: `你與某位貓咪的靈魂同步率達到 ${matchScore}/100！<br>進入 Inbox 查看你們的連線詳情。`,
    cta: '查看 Inbox →',
    ctaUrl: `${SITE_URL}/inbox`,
    prefKey: 'email_on_match',
  });
}

/**
 * Notify a user that they received a new letter.
 * Called after sendLetter succeeds.
 */
export async function notifyNewLetter(recipientId, senderDisplayName) {
  const safeName = (senderDisplayName || '神秘貓咪').slice(0, 30);
  await sendInboxNotification(recipientId, {
    subject: '✉️ 你有一封新的月光信！',
    title: '新月光信到達',
    body: `<strong style="color:#e8e3f5;">${safeName}</strong> 給你寫了一封信。<br>回信或查看對方的 Mirror Card 來了解更多。`,
    cta: '查看 Inbox →',
    ctaUrl: `${SITE_URL}/inbox`,
    prefKey: 'email_on_letter',
  });
}

/**
 * Notify a user that someone requested a photo exchange.
 */
export async function notifyPhotoExchangeRequest(recipientId, { senderName, requesterSlug }) {
  const safeName = (senderName || '某位貓咪').slice(0, 30);
  const mirrorPath = requesterSlug
    ? `/mirror-card/${encodeURIComponent(requesterSlug)}`
    : '/inbox';
  await sendInboxNotification(recipientId, {
    subject: '📷 有人想與你交換相片',
    title: '交換相邀請',
    body: `<strong style="color:#e8e3f5;">${safeName}</strong> 想與你交換真人相片。<br>到對方的 Mirror Card 回覆即可開始交換。`,
    cta: requesterSlug ? '前往 Mirror Card →' : '查看 Inbox →',
    ctaUrl: `${SITE_URL}${mirrorPath}`,
    prefKey: 'email_on_letter',
  });
}

/**
 * Notify a user they were @mentioned in the forum.
 */
export async function notifyForumMention(recipientId, { actorName, postId, commentId }) {
  const safeName = (actorName || '某位貓咪').slice(0, 30);
  const path = `/forum/${postId}${commentId ? '#comments' : ''}`;
  await sendInboxNotification(recipientId, {
    subject: '🐈‍⬛ 有人在黑貓樹洞提及你',
    title: '你被 @ 了',
    body: `<strong style="color:#e8e3f5;">${safeName}</strong> 在討論區提及你。<br>點擊查看貼文並參與討論。`,
    cta: '查看貼文 →',
    ctaUrl: `${SITE_URL}${path}`,
    prefKey: 'email_on_forum_mention',
  });
}
