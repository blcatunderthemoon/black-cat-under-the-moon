/**
 * POST /api/dashboard/create-gmail-drafts
 *
 * Body: { pairs: [{ userAId, userBId, match_score }] }
 *
 * For each pair, builds 2 personalised emails (A→B, B→A) and saves them to
 * Gmail's Drafts folder via IMAP APPEND — no email is sent.
 * Also records the pair in the Supabase `email_drafts` table for dashboard
 * badge tracking.
 *
 * Required env vars:
 *   GMAIL_USER          – sender Gmail address
 *   GMAIL_APP_PASSWORD  – 16-char Gmail App Password
 */

import nodemailer  from 'nodemailer';
import { ImapFlow } from 'imapflow';
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

function normalisePair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

/** Use nodemailer's stream transport to build raw RFC-2822 MIME bytes */
async function buildRawMime({ from, to, subject, html, text, attachments }) {
  const streamTransport = nodemailer.createTransport({ streamTransport: true, newline: 'unix' });
  const info = await streamTransport.sendMail({ from, to, subject, html, text, ...(attachments ? { attachments } : {}) });
  const chunks = [];
  for await (const chunk of info.message) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** Find the Drafts mailbox path by its \\Drafts special-use attribute */
async function findDraftsPath(client) {
  const tree = await client.listTree();
  const walk = (nodes) => {
    for (const node of nodes) {
      // imapflow returns specialUse as a plain string, e.g. '\\Drafts'
      if (node.specialUse && node.specialUse.toLowerCase().includes('drafts')) return node.path;
      if (node.folders?.length) {
        const found = walk(node.folders);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(tree.folders || []) || '[Gmail]/Drafts';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(503).json({
      error: 'Gmail not configured.',
      hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart.',
    });
  }

  const body  = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const pairs = body.pairs;

  if (!Array.isArray(pairs) || pairs.length === 0) {
    return res.status(400).json({ error: 'pairs must be a non-empty array.' });
  }

  for (const p of pairs) {
    const a = Number(p.userAId), b = Number(p.userBId);
    if (!a || !b || a === b || !Number.isInteger(a) || !Number.isInteger(b)) {
      return res.status(400).json({ error: `Invalid pair: ${JSON.stringify(p)}` });
    }
  }

  // Fetch user records
  const allIds = [...new Set(pairs.flatMap((p) => [Number(p.userAId), Number(p.userBId)]))];
  const { data: users, error: usersError } = await supabase
    .from('responses').select('*').in('id', allIds);
  if (usersError) return res.status(500).json({ error: usersError.message });
  const userMap = Object.fromEntries((users || []).map((u) => [Number(u.id), u]));

  // Open IMAP connection once for all drafts
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    logger: false,
  });

  try {
    await client.connect();
    const draftsPath = await findDraftsPath(client);

    const results      = [];
    const supabaseRows = [];

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

      const draftsCreated = [];

      for (const [receiver, partner] of [[userA, userB], [userB, userA]]) {
        console.log('[draft-debug] receiver:', { id: receiver.id, name: receiver.name, email: receiver.email, ig: receiver.ig_username });
        console.log('[draft-debug] partner :', { id: partner.id,   name: partner.name,   email: partner.email,   ig: partner.ig_username });
        if (!receiver.email) {
          draftsCreated.push({ to: receiver.id, skipped: true, reason: 'No email address' });
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
          const rawMime = await buildRawMime({
            from: `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`,
            to:   receiver.email,
            subject: `你與 ${partner.name} 配對成功 ✨ | Black Cat Under The Moon`,
            html: buildEmailHtml({ receiver, partner, score }),
            text: buildTextEmail({ receiver, partner, score }),
            attachments: [{
              filename: `配對卡_${safeA}_x_${safeB}.html`,
              content: cardHtml,
              contentType: 'text/html; charset=utf-8',
            }],
          });

          await client.append(draftsPath, rawMime, ['\\Draft', '\\Seen']);
          draftsCreated.push({ to: receiver.id, saved: true });
        } catch (err) {
          draftsCreated.push({ to: receiver.id, saved: false, error: err.message });
        }
      }

      const [normA, normB] = normalisePair(aId, bId);
      supabaseRows.push({ user_a_id: normA, user_b_id: normB, match_score: score, notes: 'Gmail 草稿已建立' });
      results.push({ userAId: aId, userBId: bId, score, draftsCreated });
    }

    await client.logout();

    // Record in email_drafts for dashboard badge
    if (supabaseRows.length > 0) {
      await supabase
        .from('email_drafts')
        .upsert(supabaseRows, { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: false });
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    try { await client.logout(); } catch (_) { /* ignore */ }
    console.error('[create-gmail-drafts]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
