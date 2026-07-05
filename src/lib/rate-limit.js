/**
 * Shared Upstash rate limiting. Production fail-closed when Redis is not configured.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { isProduction } from './production-guard.js';

let redis = null;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

export function getClientIp(req) {
  return (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || '127.0.0.1';
}

export function createRateLimiter(name, limit, window) {
  const r = getRedis();
  if (!r) return null;
  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `bcutm:${name}`,
  });
}

/**
 * @returns {{ ok: boolean, reason?: string }}
 */
export async function rateLimitOrPass(limiter, key) {
  if (!limiter) {
    if (isProduction()) {
      return { ok: false, reason: 'rate_limit_unconfigured' };
    }
    return { ok: true };
  }
  const { success } = await limiter.limit(key);
  return success ? { ok: true } : { ok: false, reason: 'rate_limited' };
}

export function rateLimitResponse(res, reason = 'rate_limited') {
  if (reason === 'rate_limit_unconfigured') {
    return res.status(503).json({ error: 'Rate limiting is not configured' });
  }
  return res.status(429).json({ error: '請求太頻繁，請稍後再試。' });
}
