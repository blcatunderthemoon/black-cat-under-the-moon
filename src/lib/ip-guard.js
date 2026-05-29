/**
 * src/lib/ip-guard.js
 * IP-level abuse detection for Drift Bottle API routes.
 *
 * Two layers:
 * 1. Manual block  — checks `ipblock:{ip}` key (24h TTL, set by burst detection).
 * 2. Burst detect  — counts requests via `burst:{ip}` in a 2-second sliding window.
 *    If >5 requests within 2 seconds, the IP is blocked for 24 hours.
 *
 * Fails open on Redis errors (returns { blocked: false }) so a Redis outage
 * never takes down the platform for legitimate users.
 *
 * Only active when UPSTASH_REDIS_REST_URL is configured.
 */

import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? Redis.fromEnv()
  : null;

const BURST_WINDOW_SECS = 2;
const BURST_THRESHOLD   = 5;
const BLOCK_TTL_SECS    = 86400; // 24 hours

/**
 * @param {string} ip
 * @returns {Promise<{ blocked: boolean, reason?: 'banned' | 'burst' }>}
 */
export async function checkIp(ip) {
  if (!redis || !ip) return { blocked: false };

  try {
    // Layer 1: existing 24h ban
    const isBlocked = await redis.get(`ipblock:${ip}`);
    if (isBlocked) return { blocked: true, reason: 'banned' };

    // Layer 2: burst detection
    const burstKey = `burst:${ip}`;
    const count = await redis.incr(burstKey);
    if (count === 1) {
      // First increment — set the expiry for this window
      await redis.expire(burstKey, BURST_WINDOW_SECS);
    }
    if (count > BURST_THRESHOLD) {
      await redis.set(`ipblock:${ip}`, '1', { ex: BLOCK_TTL_SECS });
      return { blocked: true, reason: 'burst' };
    }

    return { blocked: false };
  } catch {
    // Fail open — Redis errors must not block real users
    return { blocked: false };
  }
}
