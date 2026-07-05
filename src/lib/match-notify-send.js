/**
 * Shared match notification delivery for dashboard send flows.
 */

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { buildEmailHtml, buildTextEmail } from './email-template.js';
import { computeCompatibility } from './intelligence.js';
import { deliverMatchCard } from './inbox.js';
import {
  buildMonthlyMatchCounts,
  getResponseMatchQuota,
  pairCanDeliverMatch,
} from './match-delivery-quota.js';
import { buildMatchResponsePremiumContext } from './match-response-premium.js';
import {
  linkResponseToAuthUser,
  resolveResponseAuthUserId,
  resolveResponseDeliveryEmail,
} from './match-response-auth.js';
import { buildMatchCardHtml } from '../pages/api/match_card/template.js';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}

function normalisePair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * @param {Array<{ userAId: number, userBId: number, match_score?: number }>} pairs
 * @param {{ deliverInbox?: boolean, skipQuotaCheck?: boolean }} [opts]
 */
export async function sendMatchNotificationPairs(pairs, opts = {}) {
  const { deliverInbox = false, skipQuotaCheck = false } = opts;
  const supabase = getSupabase();
  const transporter = getTransporter();

  if (!transporter) {
    return {
      ok: false,
      status: 503,
      error: 'Email sending is not configured yet.',
      hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to your .env.local, then restart the dev server.',
    };
  }

  const allIds = [...new Set(pairs.flatMap((p) => [Number(p.userAId), Number(p.userBId)]))];
  const { data: users, error: usersError } = await supabase
    .from('responses')
    .select('*')
    .in('id', allIds);

  if (usersError) {
    return { ok: false, status: 500, error: usersError.message };
  }

  const userMap = Object.fromEntries((users || []).map((u) => [Number(u.id), u]));
  const premiumCtx = await buildMatchResponsePremiumContext(users || []);

  const { data: sentRows } = await supabase.from('sent_matches').select('user_a_id, user_b_id, sent_at');
  const monthlyCounts = buildMonthlyMatchCounts(sentRows || []);

  const quotaFor = (row) =>
    getResponseMatchQuota(
      row.id,
      row.user_id || null,
      premiumCtx.tierByUserId,
      monthlyCounts,
      { emailIsPremium: premiumCtx.isResponsePremium(row) },
    );

  const results = [];

  for (const p of pairs) {
    const aId = Number(p.userAId);
    const bId = Number(p.userBId);
    const userA = userMap[aId];
    const userB = userMap[bId];

    if (!userA || !userB) {
      results.push({ userAId: aId, userBId: bId, error: 'User not found' });
      continue;
    }

    const quotaA = quotaFor(userA);
    const quotaB = quotaFor(userB);
    const hasPremium = quotaA.is_premium || quotaB.is_premium;

    let authA = await resolveResponseAuthUserId(supabase, userA);
    let authB = await resolveResponseAuthUserId(supabase, userB);
    if (authA && !userA.user_id) authA = await linkResponseToAuthUser(supabase, userA, authA);
    if (authB && !userB.user_id) authB = await linkResponseToAuthUser(supabase, userB, authB);

    const shouldDeliverInbox = deliverInbox || (hasPremium && !!(authA || authB));

    if (!skipQuotaCheck && !pairCanDeliverMatch(quotaA, quotaB)) {
      results.push({
        userAId: aId,
        userBId: bId,
        error: 'quota_exceeded',
        user_a_quota: quotaA,
        user_b_quota: quotaB,
      });
      continue;
    }

    const intelligence = computeCompatibility(userA, userB);
    const score = Math.max(
      0,
      Math.min(100, Math.round(intelligence.finalScore || Number(p.match_score) || 0)),
    );

    const deliveries = [];

    for (const [receiver, partner] of [[userA, userB], [userB, userA]]) {
      const toEmail = await resolveResponseDeliveryEmail(supabase, receiver);
      if (!toEmail) {
        deliveries.push({ to: receiver.id, skipped: true, reason: 'No email address' });
        continue;
      }

      try {
        const cardHtml = buildMatchCardHtml({
          user: receiver,
          target: partner,
          score,
          breakdown: intelligence.dimensionScores || {},
          intelligence,
        });
        const safeA = String(receiver.name).replace(/[^\w\u4e00-\u9fff]/g, '_');
        const safeB = String(partner.name).replace(/[^\w\u4e00-\u9fff]/g, '_');
        await transporter.sendMail({
          from: `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`,
          to: toEmail,
          subject: `你與 ${partner.name} 配對成功 ✨ | Black Cat Under The Moon`,
          html: buildEmailHtml({ receiver, partner, score }),
          text: buildTextEmail({ receiver, partner, score }),
          attachments: [{
            filename: `配對卡_${safeA}_x_${safeB}.html`,
            content: cardHtml,
            contentType: 'text/html; charset=utf-8',
          }],
        });
        deliveries.push({ to: receiver.id, delivered: true });
      } catch (err) {
        deliveries.push({ to: receiver.id, delivered: false, error: err.message });
      }
    }

    let inbox = null;
    if (shouldDeliverInbox) {
      inbox = await deliverMatchCard({
        responseAId: aId,
        responseBId: bId,
        matchScore: score,
        matchSummary: intelligence.dimensionScores || {},
        skipEmailNotify: true,
      });
    }

    const [normA, normB] = normalisePair(aId, bId);
    const anyDelivered = deliveries.some((d) => d.delivered);
    const noteParts = [];
    if (anyDelivered) noteParts.push('郵件已送出');
    if (inbox?.delivered) noteParts.push('Inbox 已投送');
    if (hasPremium) noteParts.push('Moonlight Passport');

    await supabase.from('sent_matches').upsert(
      {
        user_a_id: normA,
        user_b_id: normB,
        match_score: score,
        notes: noteParts.length ? `自動記錄（${noteParts.join('、')}）` : '自動記錄（發送失敗）',
      },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: false },
    );

    await supabase
      .from('email_drafts')
      .delete()
      .eq('user_a_id', normA)
      .eq('user_b_id', normB);

    results.push({
      userAId: aId,
      userBId: bId,
      score,
      has_premium: hasPremium,
      inbox_delivered: !!inbox?.delivered,
      user_a_quota: quotaA,
      user_b_quota: quotaB,
      deliveries,
      inbox,
      recorded: true,
    });
  }

  return { ok: true, results };
}
