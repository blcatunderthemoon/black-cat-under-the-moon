import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const deliveryWebhook = process.env.MATCH_NOTIFICATION_WEBHOOK || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHandle(value) {
  const raw = String(value ?? '').trim();
  return raw;
}

function buildContactList(partner) {
  const parts = [];
  if (partner.email) parts.push(`Email ${escHtml(partner.email)}`);
  if (partner.ig_username) parts.push(`IG ${escHtml(partner.ig_username)}`);
  if (partner.tg_username) parts.push(`TG ${escHtml(partner.tg_username)}`);
  return parts.join(' / ') || '（未提供聯絡資料）';
}

function buildEmailHtml({ receiver, partner, score }) {
  const contactInfo = buildContactList(partner);
  return `
  <div style="background:#07060e;padding:24px;color:#f0ebd8;font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#12111d;border:2px solid #00e5ff;padding:20px;box-shadow:0 0 24px rgba(0,229,255,.2)">
      <h2 style="margin:0 0 12px;color:#ffe066;">每日靈魂配對通知</h2>
      <p style="line-height:1.8;margin:0 0 8px;">Hi ${escHtml(receiver.name)}，你同 ${escHtml(partner.name)} 配對成功。</p>
      <p style="line-height:1.8;margin:0 0 12px;">同步率：<span style="color:#00e5ff;font-weight:700;">${score}/100</span></p>
      <p style="line-height:1.8;margin:0;">對方聯絡：${contactInfo}</p>
    </div>
  </div>`;
}

function buildText({ receiver, partner, score }) {
  const parts = [];
  if (partner.email) parts.push(`Email ${partner.email}`);
  if (partner.ig_username) parts.push(`IG ${partner.ig_username}`);
  if (partner.tg_username) parts.push(`TG ${partner.tg_username}`);
  const contactInfo = parts.join(' / ') || '（未提供聯絡資料）';
  return [
    `Hi ${receiver.name},`,
    `你同 ${partner.name} 成功配對。`,
    `同步率：${score}/100`,
    `對方聯絡：${contactInfo}`,
    'Black Cat Under The Moon',
  ].join('\n');
}

async function deliver(payload) {
  if (!deliveryWebhook) {
    return { delivered: false, reason: 'MATCH_NOTIFICATION_WEBHOOK not configured' };
  }

  try {
    const resp = await fetch(deliveryWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await resp.text();
    return {
      delivered: resp.ok,
      status: resp.status,
      response: body.slice(0, 500),
    };
  } catch (err) {
    return { delivered: false, reason: err.message || 'Webhook delivery failed' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userAId = Number(body.userAId);
    const userBId = Number(body.userBId);
    const score = Math.max(0, Math.min(100, Math.round(Number(body.match_score) || 0)));

    if (!userAId || !userBId) {
      return res.status(400).json({ error: 'userAId and userBId are required' });
    }

    const { data: rows, error } = await supabase
      .from('responses')
      .select('id,name,email,ig_username,tg_username,identity')
      .in('id', [userAId, userBId]);

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }

    const userA = rows?.find((r) => Number(r.id) === userAId);
    const userB = rows?.find((r) => Number(r.id) === userBId);

    if (!userA || !userB) {
      return res.status(404).json({ error: 'Matched users not found in responses' });
    }

    const notifications = [
      {
        to: userA.email,
        to_user_id: userA.id,
        subject: `你與 ${userB.name} 配對成功 | Black Cat Under The Moon`,
        html: buildEmailHtml({ receiver: userA, partner: userB, score }),
        text: buildText({ receiver: userA, partner: userB, score }),
      },
      {
        to: userB.email,
        to_user_id: userB.id,
        subject: `你與 ${userA.name} 配對成功 | Black Cat Under The Moon`,
        html: buildEmailHtml({ receiver: userB, partner: userA, score }),
        text: buildText({ receiver: userB, partner: userA, score }),
      },
    ];

    const deliveries = [];
    for (const note of notifications) {
      const delivery = await deliver(note);
      deliveries.push({ to_user_id: note.to_user_id, ...delivery });
    }

    // ---- Auto-log to sent_matches (normalise pair order: smaller id first) ----
    const [normA, normB] = userAId <= userBId ? [userAId, userBId] : [userBId, userAId];
    const anyDelivered = deliveries.some((d) => d.delivered);
    await supabase
      .from('sent_matches')
      .upsert(
        {
          user_a_id: normA,
          user_b_id: normB,
          match_score: score,
          notes: anyDelivered ? '自動記錄（通知已發送）' : '自動記錄（通知發送失敗）',
        },
        { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: false }
      );

    return res.status(200).json({
      success: true,
      match_pair: {
        userA: { id: userA.id, name: userA.name, email: userA.email, ig_username: userA.ig_username, tg_username: userA.tg_username },
        userB: { id: userB.id, name: userB.name, email: userB.email, ig_username: userB.ig_username, tg_username: userB.tg_username },
      },
      match_score: score,
      notifications_preview: notifications,
      deliveries,
    });
  } catch (err) {
    console.error('Match notify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
