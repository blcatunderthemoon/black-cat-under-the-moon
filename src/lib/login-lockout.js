/**
 * Login brute-force lockout (per email).
 * 10 failed attempts within the attempt window → temporary account freeze.
 */

import { Redis } from '@upstash/redis';
import { isProduction } from './production-guard.js';

/** Consecutive wrong passwords (without a success) that trigger a freeze. */
export const LOGIN_MAX_FAILED_ATTEMPTS = 10;

/** Sliding window for counting failed attempts. */
export const LOGIN_ATTEMPT_WINDOW_SEC = 15 * 60; // 15 minutes

/** How long the account stays frozen after hitting the limit. */
export const LOGIN_LOCKOUT_SEC = 30 * 60; // 30 minutes

const FAIL_PREFIX = 'bcutm:login:fail:';
const LOCK_PREFIX = 'bcutm:login:lock:';

/** @type {Map<string, { value: string, expiresAt: number }> | null} */
let memoryStore = null;

function getMemoryStore() {
  if (!memoryStore) {
    memoryStore = globalThis.__bcutmLoginLockoutMemory || new Map();
    globalThis.__bcutmLoginLockoutMemory = memoryStore;
  }
  return memoryStore;
}

function memoryGet(key) {
  const store = getMemoryStore();
  const row = store.get(key);
  if (!row) return null;
  if (row.expiresAt && Date.now() > row.expiresAt) {
    store.delete(key);
    return null;
  }
  return row.value;
}

function memorySet(key, value, ttlSec) {
  const store = getMemoryStore();
  store.set(key, {
    value: String(value),
    expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0,
  });
}

function memoryDel(...keys) {
  const store = getMemoryStore();
  for (const key of keys) store.delete(key);
}

function memoryIncr(key, ttlSec) {
  const current = Number(memoryGet(key) || 0);
  const next = current + 1;
  const store = getMemoryStore();
  const existing = store.get(key);
  const expiresAt = existing?.expiresAt && existing.expiresAt > Date.now()
    ? existing.expiresAt
    : Date.now() + ttlSec * 1000;
  store.set(key, { value: String(next), expiresAt });
  return next;
}

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return Redis.fromEnv();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function failKey(email) {
  return `${FAIL_PREFIX}${normalizeEmail(email)}`;
}

function lockKey(email) {
  return `${LOCK_PREFIX}${normalizeEmail(email)}`;
}

/**
 * @returns {{ ok: true, backend: 'redis' | 'memory' } | { ok: false, reason: string }}
 */
export function getLoginLockoutBackend() {
  if (getRedis()) return { ok: true, backend: 'redis' };
  if (!isProduction()) return { ok: true, backend: 'memory' };
  return { ok: false, reason: 'rate_limit_unconfigured' };
}

/**
 * @param {string} email
 * @returns {Promise<{ locked: boolean, lockoutUntil: number | null, retryAfterSeconds: number }>}
 */
export async function getLoginLockoutStatus(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { locked: false, lockoutUntil: null, retryAfterSeconds: 0 };
  }

  const redis = getRedis();
  const key = lockKey(normalized);
  let raw = null;

  if (redis) {
    raw = await redis.get(key);
  } else if (!isProduction()) {
    raw = memoryGet(key);
  }

  const lockoutUntil = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(lockoutUntil) || lockoutUntil <= Date.now()) {
    return { locked: false, lockoutUntil: null, retryAfterSeconds: 0 };
  }

  return {
    locked: true,
    lockoutUntil,
    retryAfterSeconds: Math.max(1, Math.ceil((lockoutUntil - Date.now()) / 1000)),
  };
}

/**
 * Record a failed password attempt. May trigger a freeze.
 * @param {string} email
 * @returns {Promise<{ locked: boolean, failureCount: number, lockoutUntil: number | null, retryAfterSeconds: number }>}
 */
export async function recordLoginFailure(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return {
      locked: false,
      failureCount: 0,
      lockoutUntil: null,
      retryAfterSeconds: 0,
    };
  }

  const redis = getRedis();
  const fKey = failKey(normalized);
  const lKey = lockKey(normalized);

  let failureCount = 0;
  if (redis) {
    failureCount = await redis.incr(fKey);
    if (failureCount === 1) {
      await redis.expire(fKey, LOGIN_ATTEMPT_WINDOW_SEC);
    }
  } else if (!isProduction()) {
    failureCount = memoryIncr(fKey, LOGIN_ATTEMPT_WINDOW_SEC);
  } else {
    return {
      locked: false,
      failureCount: 0,
      lockoutUntil: null,
      retryAfterSeconds: 0,
    };
  }

  if (failureCount < LOGIN_MAX_FAILED_ATTEMPTS) {
    return {
      locked: false,
      failureCount,
      lockoutUntil: null,
      retryAfterSeconds: 0,
    };
  }

  const lockoutUntil = Date.now() + LOGIN_LOCKOUT_SEC * 1000;
  if (redis) {
    await redis.set(lKey, String(lockoutUntil), { px: LOGIN_LOCKOUT_SEC * 1000 });
    await redis.del(fKey);
  } else {
    memorySet(lKey, String(lockoutUntil), LOGIN_LOCKOUT_SEC);
    memoryDel(fKey);
  }

  return {
    locked: true,
    failureCount,
    lockoutUntil,
    retryAfterSeconds: LOGIN_LOCKOUT_SEC,
  };
}

/**
 * Clear failure + lockout state after a successful login (or password reset).
 * @param {string} email
 */
export async function clearLoginLockout(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const redis = getRedis();
  const keys = [failKey(normalized), lockKey(normalized)];
  if (redis) {
    await redis.del(...keys);
    return;
  }
  if (!isProduction()) {
    memoryDel(...keys);
  }
}

/**
 * Human-readable freeze message (Traditional Chinese).
 * @param {number} retryAfterSeconds
 */
export function formatLoginLockoutMessage(retryAfterSeconds) {
  const sec = Math.max(1, Number(retryAfterSeconds) || LOGIN_LOCKOUT_SEC);
  const minutes = Math.max(1, Math.ceil(sec / 60));
  return `密碼錯誤次數過多，帳號已暫時鎖定約 ${minutes} 分鐘。請稍後再試，或使用「忘記密碼」重設。`;
}
