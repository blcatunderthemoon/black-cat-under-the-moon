/**
 * Anonymous site-wide presence — active visitors in the last ~90s (Upstash sorted set).
 */

import { Redis } from '@upstash/redis';

const PRESENCE_KEY = 'bcutm:site:presence';
const TTL_MS = 90_000;

let redis = null;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

export function isSitePresenceEnabled() {
  return Boolean(getRedis());
}

async function pruneAndCount(r) {
  const now = Date.now();
  await r.zremrangebyscore(PRESENCE_KEY, 0, now - TTL_MS);
  return r.zcard(PRESENCE_KEY);
}

export async function touchSitePresence(sessionId) {
  const r = getRedis();
  if (!r || !sessionId) return 0;
  try {
    const now = Date.now();
    await r.zadd(PRESENCE_KEY, { score: now, member: sessionId });
    return pruneAndCount(r);
  } catch (err) {
    console.error('[site-presence] touch:', err?.message || err);
    return 0;
  }
}

export async function getSitePresenceCount() {
  const r = getRedis();
  if (!r) return 0;
  try {
    return pruneAndCount(r);
  } catch (err) {
    console.error('[site-presence] count:', err?.message || err);
    return 0;
  }
}
