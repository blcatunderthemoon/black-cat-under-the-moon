/**
 * Moonlight Gatherings — HKT month calendar helpers (client + server safe).
 */

import {
  getHongKongDateParts,
  getHongKongDateString,
  hongKongMidnightUtc,
} from './hong-kong-time.js';

/** First calendar month available for browsing / posting. */
export const GATHERING_CALENDAR_MIN = Object.freeze({ year: 2026, month: 7 });

const WEEKDAY_LABELS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

export function gatheringWeekdayLabelsZh() {
  return WEEKDAY_LABELS_ZH;
}

export function formatGatheringYm(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseGatheringYm(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

export function compareGatheringYm(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function shiftGatheringYm(year, month, deltaMonths) {
  const idx = year * 12 + (month - 1) + deltaMonths;
  return {
    year: Math.floor(idx / 12),
    month: (idx % 12) + 1,
  };
}

export function clampGatheringYm(year, month, min = GATHERING_CALENDAR_MIN) {
  if (compareGatheringYm({ year, month }, min) < 0) {
    return { year: min.year, month: min.month };
  }
  return { year, month };
}

/** Current HKT calendar month, clamped to calendar start. */
export function currentGatheringYm(now = new Date()) {
  const { year, month } = getHongKongDateParts(now);
  return clampGatheringYm(year, month);
}

/** Inclusive month range as ISO instants for API (`to` = last ms of month). */
export function gatheringMonthRangeIso(year, month) {
  const fromDate = hongKongMidnightUtc(year, month, 1);
  const endExclusive = month === 12
    ? hongKongMidnightUtc(year + 1, 1, 1)
    : hongKongMidnightUtc(year, month + 1, 1);
  const toDate = new Date(endExclusive.getTime() - 1);
  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}

export function gatheringDateKeyFromIso(iso) {
  if (!iso) return '';
  return getHongKongDateString(new Date(iso));
}

export function isGatheringYmAtMin(year, month, min = GATHERING_CALENDAR_MIN) {
  return compareGatheringYm({ year, month }, min) <= 0;
}

/**
 * Monday-first month grid cells for HKT calendar UI.
 * @returns {{ dateKey: string, day: number, inMonth: boolean, isToday: boolean }[]}
 */
export function buildGatheringMonthGrid(year, month, now = new Date()) {
  const todayKey = getHongKongDateString(now);
  // Weekday of the civil HKT date (Mon=0 … Sun=6), via UTC noon of that Y-M-D.
  const weekdayMon0 = (y, m, d) => {
    const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0);
    return (new Date(utcNoon).getUTCDay() + 6) % 7;
  };
  const firstWeekday = weekdayMon0(year, month, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysInPrev = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    const day = daysInPrev - firstWeekday + i + 1;
    const dateKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ dateKey, day, inMonth: false, isToday: dateKey === todayKey });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ dateKey, day, inMonth: true, isToday: dateKey === todayKey });
  }
  let nextDay = 1;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  while (cells.length % 7 !== 0) {
    const day = nextDay;
    nextDay += 1;
    const dateKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ dateKey, day, inMonth: false, isToday: dateKey === todayKey });
  }
  return cells;
}

export function groupGatheringsByHkDate(gatherings) {
  const map = new Map();
  for (const g of gatherings || []) {
    const key = gatheringDateKeyFromIso(g.starts_at);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(g);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }
  return map;
}

/**
 * Default create datetime-local value for a chosen calendar date.
 * Returns the SAME date at the given wall-clock time (default 19:00) so the
 * form's 開始時間 always matches the picked 選定日期 (no timezone drift).
 */
export function defaultStartsLocalForHkDate(dateKey, hour = 19, minute = 0) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${m[1]}-${m[2]}-${m[3]}T${pad(hour)}:${pad(minute)}`;
}
