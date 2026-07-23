/**
 * GET/POST /api/cron/forum-hit-topics
 *
 * Daily rotation: pick lesbian hit topics → merge into forum_banner (id=1).
 * Auth: Authorization Bearer CRON_SECRET (Vercel Cron) or x-cron-secret.
 *
 * Env:
 *   CRON_SECRET — required in production
 *   FORUM_HIT_TOPIC_CRON_ENABLED — set "0" to no-op
 *   FORUM_HIT_TOPIC_CRON_FORCE_ACTIVE — default "1"; set "0" to leave active flag untouched
 *   FORUM_HIT_TOPIC_DAILY_COUNT — default 3 (max 12)
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeBannerMessages } from '../../../lib/forum-banner.js';
import { getHongKongDateString } from '../../../lib/hong-kong-time.js';
import {
  HIT_TOPIC_DAILY_COUNT,
  hitTopicsToBannerMessages,
  mergeHitTopicBannerMessages,
  pickDailyHitTopics,
} from '../../../lib/forum-hit-topics.js';

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const header = String(req.headers['x-cron-secret'] || '').trim();
  return bearer === secret || header === secret;
}

function parseDailyCount() {
  const raw = Number(process.env.FORUM_HIT_TOPIC_DAILY_COUNT);
  if (!Number.isFinite(raw)) return HIT_TOPIC_DAILY_COUNT;
  return Math.max(1, Math.min(12, Math.floor(raw)));
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (process.env.FORUM_HIT_TOPIC_CRON_ENABLED === '0') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'disabled' });
  }

  const dayKey = getHongKongDateString();
  const count = parseDailyCount();
  const picked = pickDailyHitTopics(new Date(), count);
  const hitMessages = hitTopicsToBannerMessages(picked, dayKey);

  const supabase = getServiceClient();
  const { data: existing, error: readErr } = await supabase
    .from('forum_banner')
    .select('id, active, messages')
    .eq('id', 1)
    .maybeSingle();

  if (readErr?.code === '42P01') {
    return res.status(503).json({
      error: 'forum_banner table missing — run migration 20260713100000_forum_banner.sql',
    });
  }
  if (readErr) {
    console.error('[cron/forum-hit-topics] read failed:', readErr.message);
    return res.status(500).json({ error: readErr.message });
  }

  const existingMessages = normalizeBannerMessages(existing?.messages);
  const merged = normalizeBannerMessages(
    mergeHitTopicBannerMessages(existingMessages, hitMessages),
  );

  const forceActive = process.env.FORUM_HIT_TOPIC_CRON_FORCE_ACTIVE !== '0';
  const patch = {
    id: 1,
    messages: merged,
    updated_at: new Date().toISOString(),
  };
  if (forceActive) patch.active = true;

  const { data, error: writeErr } = await supabase
    .from('forum_banner')
    .upsert(patch, { onConflict: 'id' })
    .select('id, active, messages, updated_at')
    .single();

  if (writeErr) {
    console.error('[cron/forum-hit-topics] upsert failed:', writeErr.message);
    return res.status(500).json({ error: writeErr.message });
  }

  return res.status(200).json({
    ok: true,
    day: dayKey,
    count: hitMessages.length,
    topics: picked.map((t) => t.id),
    banner_active: !!data?.active,
    message_count: Array.isArray(data?.messages) ? data.messages.length : merged.length,
  });
}
