/**
 * GET /api/public/bottle-stats
 * Public weekly drift-bottle count for homepage carousel tag.
 */
import { createClient } from '@supabase/supabase-js';
import {
  createRateLimiter,
  getClientIp,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../lib/rate-limit.js';
import { databaseNowIso } from '../../../lib/hong-kong-time.js';

const readLimiter = createRateLimiter('bottle-stats-read', 60, '1 m');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = await rateLimitOrPass(readLimiter, ip);
  if (!rl.ok) return rateLimitResponse(res, rl.reason);

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(200).json({ weekly_new: 0 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const now = databaseNowIso();
    const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();

    const { count, error } = await supabase
      .from('bottles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('created_at', weekAgo)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error) {
      console.error('[bottle-stats]', error.message);
      return res.status(200).json({ weekly_new: 0 });
    }

    return res.status(200).json({
      weekly_new: typeof count === 'number' && count > 0 ? count : 0,
    });
  } catch (err) {
    console.error('[bottle-stats]', err?.message || err);
    return res.status(200).json({ weekly_new: 0 });
  }
}
