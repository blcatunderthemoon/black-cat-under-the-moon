/**
 * Moonlight Wishes (月光心願) — shared helpers for Phase 1 MVP.
 * Spec: docs/community/MOONLIGHT-WISHES-PLAN.md
 */

import { getHongKongDateString } from './hong-kong-time.js';

export const WISH_CATEGORIES = ['習慣', '學習', '健康', '創作', '感情成長', '社群', '其他'];
export const WISH_VISIBILITIES = ['public', 'members'];
export const WISH_STATUSES = ['active', 'completed', 'abandoned', 'hidden', 'expired'];
export const WISH_ACTIVE_LIMIT = 3;
export const WISH_TITLE_MIN = 8;
export const WISH_TITLE_MAX = 40;
export const WISH_BODY_MAX = 300;
export const WISH_CHEER_NOTE_MAX = 40;
export const WISH_COMPLETION_NOTE_MAX = 200;
export const WISH_TARGET_MAX_DAYS = 90;
export const WISH_CHEER_DAILY_LIMIT = 20;
export const WISH_COMPLETE_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const WISH_LIST_DEFAULT_LIMIT = 40;
export const WISH_LIST_MAX_LIMIT = 100;
/** Daily stamp calendar — soft journal, max cells shown */
export const WISH_CHECKIN_GRID_MAX = 31;
export const WISH_CHECKIN_DEFAULT_DAYS = 7;

export function normalizeWishText(value, max) {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, ' ');
  if (!text) return null;
  return text.slice(0, max);
}

export function validateWishInput(body = {}, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.title !== undefined) {
    const title = normalizeWishText(body.title, WISH_TITLE_MAX);
    if (!title || title.length < WISH_TITLE_MIN) {
      errors.push(`標題需 ${WISH_TITLE_MIN}–${WISH_TITLE_MAX} 字。`);
    } else {
      out.title = title;
    }
  }

  if (!partial || body.body !== undefined) {
    if (body.body == null || body.body === '') {
      out.body = null;
    } else {
      const text = normalizeWishText(body.body, WISH_BODY_MAX);
      out.body = text;
    }
  }

  if (!partial || body.category !== undefined) {
    const category = body.category == null || body.category === ''
      ? '其他'
      : String(body.category);
    if (!WISH_CATEGORIES.includes(category)) {
      errors.push('類別不正確。');
    } else {
      out.category = category;
    }
  }

  if (!partial || body.visibility !== undefined) {
    const visibility = body.visibility == null || body.visibility === ''
      ? 'public'
      : String(body.visibility);
    if (!WISH_VISIBILITIES.includes(visibility)) {
      errors.push('可見性不正確。');
    } else {
      out.visibility = visibility;
    }
  }

  if (!partial || body.progress !== undefined) {
    if (body.progress === undefined || body.progress === null || body.progress === '') {
      if (!partial) out.progress = 0;
    } else {
      const progress = Number(body.progress);
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
        errors.push('進度需為 0–100 的整數。');
      } else {
        out.progress = progress;
      }
    }
  }

  if (!partial || body.target_at !== undefined) {
    if (body.target_at == null || body.target_at === '') {
      out.target_at = null;
    } else {
      const target = new Date(body.target_at);
      if (Number.isNaN(target.getTime())) {
        errors.push('目標日期格式不正確。');
      } else {
        const max = Date.now() + WISH_TARGET_MAX_DAYS * 24 * 60 * 60 * 1000;
        if (target.getTime() > max) {
          errors.push(`目標日期建議最長 ${WISH_TARGET_MAX_DAYS} 日。`);
        } else if (target.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
          errors.push('目標日期不能早於昨天。');
        } else {
          out.target_at = target.toISOString();
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, value: out };
}

export function hongKongDayStartIso(date = new Date()) {
  return `${getHongKongDateString(date)}T00:00:00+08:00`;
}

export async function countActiveWishes(admin, userId) {
  const { count, error } = await admin
    .from('wishes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

/** Exact title collide among user's active wishes (anti-spam). */
export async function hasSimilarActiveTitle(admin, userId, title) {
  const normalized = normalizeWishText(title, WISH_TITLE_MAX);
  if (!normalized) return false;
  const { data, error } = await admin
    .from('wishes')
    .select('id, title')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(20);
  if (error) throw error;
  return (data || []).some((row) => normalizeWishText(row.title, WISH_TITLE_MAX) === normalized);
}

/**
 * Lazy-expire: if active and target_at passed, flip to expired (no penalty).
 */
export async function maybeExpireWish(admin, row) {
  if (!row || row.status !== 'active' || !row.target_at) return row;
  if (new Date(row.target_at).getTime() > Date.now()) return row;
  const { data, error } = await admin
    .from('wishes')
    .update({ status: 'expired' })
    .eq('id', row.id)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('[wishes] expire failed:', error.message);
    return { ...row, status: 'expired' };
  }
  return data || { ...row, status: 'expired' };
}

export async function enrichWishOwners(admin, wishes) {
  const ids = [...new Set((wishes || []).map((w) => w.user_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', ids);
  const map = new Map();
  for (const p of data || []) {
    map.set(p.id, {
      id: p.id,
      display_name: p.display_name || '匿名貓咪',
    });
  }
  return map;
}

export function toPublicWish(row, { owner = null, cheered = null } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    body: row.body,
    category: row.category,
    visibility: row.visibility,
    status: row.status,
    progress: row.progress,
    target_at: row.target_at,
    cheer_count: row.cheer_count ?? 0,
    completed_at: row.completed_at,
    completion_note: row.completion_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner: owner
      ? { id: owner.id, display_name: owner.display_name || '匿名貓咪' }
      : null,
    cheered_by_me: cheered === null ? undefined : !!cheered,
  };
}

export function canViewerSeeWish(wish, userId) {
  if (!wish) return false;
  if (wish.status === 'hidden') {
    return userId && wish.user_id === userId;
  }
  if (wish.status === 'abandoned') {
    return userId && wish.user_id === userId;
  }
  if (wish.visibility === 'members') {
    return !!userId;
  }
  return wish.visibility === 'public';
}

export function daysLeftLabel(targetAt) {
  if (!targetAt) return null;
  const ms = new Date(targetAt).getTime() - Date.now();
  if (ms < 0) return '已到期';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return '今日到期';
  return `剩 ${days} 日`;
}

/**
 * Build HK calendar day list for a wish stamp card.
 * @returns {{ days: string[], total: number, today: string }}
 */
export function buildWishCheckinDays(wish, { now = new Date() } = {}) {
  const today = getHongKongDateString(now);
  const start = getHongKongDateString(wish?.created_at ? new Date(wish.created_at) : now);
  const end = wish?.target_at
    ? getHongKongDateString(new Date(wish.target_at))
    : addHongKongDays(start, WISH_CHECKIN_DEFAULT_DAYS - 1);

  const last = end < start ? start : end;
  const days = [];
  let cursor = start;
  while (days.length < WISH_CHECKIN_GRID_MAX && cursor <= last) {
    days.push(cursor);
    cursor = addHongKongDays(cursor, 1);
  }

  return { days, total: days.length, today };
}

/** @param {string} dayHk YYYY-MM-DD */
export function addHongKongDays(dayHk, delta) {
  const [y, m, d] = String(dayHk).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function formatWishCheckinLabel(dayHk) {
  const parts = String(dayHk).split('-');
  if (parts.length !== 3) return dayHk;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

export function progressFromCheckins(stampedCount, totalDays) {
  const total = Math.max(1, Number(totalDays) || 1);
  const n = Math.max(0, Number(stampedCount) || 0);
  return Math.max(0, Math.min(100, Math.round((n / total) * 100)));
}

export async function listWishCheckinDays(admin, wishId) {
  const { data, error } = await admin
    .from('wish_checkins')
    .select('day_hk')
    .eq('wish_id', wishId)
    .order('day_hk', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => row.day_hk).filter(Boolean);
}

export async function syncWishProgressFromCheckins(admin, wish) {
  if (!wish?.id) return wish;
  const stamped = await listWishCheckinDays(admin, wish.id);
  const { total } = buildWishCheckinDays(wish);
  const nextProgress = progressFromCheckins(stamped.length, total);
  if (nextProgress === wish.progress) {
    return { wish, stampedDays: stamped, total };
  }
  const { data, error } = await admin
    .from('wishes')
    .update({ progress: nextProgress })
    .eq('id', wish.id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return { wish: data || { ...wish, progress: nextProgress }, stampedDays: stamped, total };
}
