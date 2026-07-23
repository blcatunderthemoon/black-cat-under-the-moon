/**
 * GET/POST /api/cron/forum-hit-topics
 *
 * Daily rotation: pick lesbian hit topics → merge into forum_banner (id=1).
 * Auth: Authorization Bearer CRON_SECRET (Vercel Cron) or x-cron-secret.
 *
 * Source of truth: forum_hit_topics (Dashboard).
 * Env kill-switch still wins:
 *   FORUM_HIT_TOPIC_CRON_ENABLED=0 — no-op
 */

import { createClient } from '@supabase/supabase-js';
import {
  loadHitTopicConfig,
  rotateHitTopicsIntoBanner,
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (process.env.FORUM_HIT_TOPIC_CRON_ENABLED === '0') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'env_disabled' });
  }

  const supabase = getServiceClient();

  try {
    const cfg = await loadHitTopicConfig(supabase);

    // Env can still force-disable banner auto-on when DB wants it on
    if (process.env.FORUM_HIT_TOPIC_CRON_FORCE_ACTIVE === '0') {
      cfg.force_banner_active = false;
    }
    if (process.env.FORUM_HIT_TOPIC_DAILY_COUNT) {
      const raw = Number(process.env.FORUM_HIT_TOPIC_DAILY_COUNT);
      if (Number.isFinite(raw)) {
        cfg.daily_count = Math.max(1, Math.min(12, Math.floor(raw)));
      }
    }

    const result = await rotateHitTopicsIntoBanner(supabase, cfg);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err?.code === '42P01') {
      return res.status(503).json({
        error: 'Required table missing — run forum_banner / forum_hit_topics migrations.',
      });
    }
    console.error('[cron/forum-hit-topics] failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
