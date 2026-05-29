/**
 * POST /api/dashboard/send-emails
 *
 * Body: { pairs: [{ userAId, userBId, match_score }] }
 *
 * Sends personalised emails to both users in each pair via Gmail SMTP
 * (Nodemailer), then:
 *   - Upserts each pair into sent_matches
 *   - Removes each pair from email_drafts (if present)
 *
 * Required env vars:
 *   GMAIL_USER          – sender address (e.g. blcatunderthemoon@gmail.com)
 *   GMAIL_APP_PASSWORD  – 16-char Gmail App Password (NOT your login password)
 */

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { buildEmailHtml, buildTextEmail } from '../../../lib/email-template.js';
import { computeCompatibility } from '../../../lib/intelligence.js';
import { buildMatchCardHtml } from '../match_card/template.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

/** Smaller ID first, consistent with sent_matches / email_drafts convention */
function normalisePair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // ── Guard: SMTP not configured yet ───────────────────────────────────────
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(503).json({
      error: 'Email sending is not configured yet.',
      hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to your .env.local, then restart the dev server.',
    });
  }

  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { pairs } = body;

  if (!Array.isArray(pairs) || pairs.length === 0) {
    return res.status(400).json({ error: 'pairs must be a non-empty array.' });
  }

  // Validate IDs
  for (const p of pairs) {
    const a = Number(p.userAId);
    const b = Number(p.userBId);
    if (!a || !b || a === b || !Number.isInteger(a) || !Number.isInteger(b)) {
      return res.status(400).json({ error: `Invalid pair: ${JSON.stringify(p)}` });
    }
  }

  // Fetch all involved user records in one query
  const allIds = [...new Set(pairs.flatMap((p) => [Number(p.userAId), Number(p.userBId)]))];
  const { data: users, error: usersError } = await supabase
    .from('responses')
    .select('*')
    .in('id', allIds);

  if (usersError) return res.status(500).json({ error: usersError.message });
  const userMap = Object.fromEntries((users || []).map((u) => [Number(u.id), u]));

  // Build Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const results = [];

  for (const p of pairs) {
    const aId   = Number(p.userAId);
    const bId   = Number(p.userBId);
    const userA = userMap[aId];
    const userB = userMap[bId];

    if (!userA || !userB) {
      results.push({ userAId: aId, userBId: bId, error: 'User not found' });
      continue;
    }

    const intelligence = computeCompatibility(userA, userB);
    const score        = Math.max(0, Math.min(100, Math.round(intelligence.finalScore || Number(p.match_score) || 0)));

    const deliveries = [];

    // Send A → B direction, B → A direction
    for (const [receiver, partner] of [[userA, userB], [userB, userA]]) {
      if (!receiver.email) {
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
          to: receiver.email,
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

    // Upsert into sent_matches
    const [normA, normB] = normalisePair(aId, bId);
    const anyDelivered = deliveries.some((d) => d.delivered);

    await supabase.from('sent_matches').upsert(
      {
        user_a_id: normA,
        user_b_id: normB,
        match_score: score,
        notes: anyDelivered
          ? '自動記錄（郵件已送出）'
          : '自動記錄（郵件發送失敗）',
      },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: false }
    );

    // Remove from email_drafts if present
    await supabase
      .from('email_drafts')
      .delete()
      .eq('user_a_id', normA)
      .eq('user_b_id', normB);

    results.push({ userAId: aId, userBId: bId, score, deliveries, recorded: true });
  }

  return res.status(200).json({ success: true, results });
}
