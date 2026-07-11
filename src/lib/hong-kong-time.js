/**
 * Hong Kong time helpers for server-side writes and business rules.
 *
 * TIMESTAMPTZ columns: use databaseNowIso() — stores the correct instant (UTC ISO).
 * DATE / calendar rules: use getHongKongDateString() and getHongKong*Start/End().
 */

export const HK_TZ = 'Asia/Hong_Kong';

const HK_OFFSET_MS = 8 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Current instant as ISO string for TIMESTAMPTZ database columns. */
export function databaseNowIso(date = new Date()) {
  return date.toISOString();
}

export function getHongKongDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
  };
}

/** YYYY-MM-DD in Hong Kong (for DATE columns and daily keys). */
export function getHongKongDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HK_TZ }).format(date);
}

/** UTC instant for 00:00:00 on a Hong Kong calendar date (HK is always UTC+8). */
export function hongKongMidnightUtc(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
}

export function getHongKongDayStart(date = new Date()) {
  const { year, month, day } = getHongKongDateParts(date);
  return hongKongMidnightUtc(year, month, day);
}

export function getHongKongDayEnd(date = new Date()) {
  return new Date(getHongKongDayStart(date).getTime() + MS_PER_DAY);
}

export function getHongKongMonthStart(date = new Date()) {
  const { year, month } = getHongKongDateParts(date);
  return hongKongMidnightUtc(year, month, 1);
}

export function getHongKongMonthEnd(date = new Date()) {
  const { year, month } = getHongKongDateParts(date);
  if (month === 12) return hongKongMidnightUtc(year + 1, 1, 1);
  return hongKongMidnightUtc(year, month + 1, 1);
}

/** YYYY-MM calendar month key in Hong Kong (for quota windows / grouping). */
export function getHongKongMonthKey(date = new Date()) {
  const { year, month } = getHongKongDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * True when `sentAt` falls in the Hong Kong calendar month containing `referenceDate`.
 * Monthly quotas reset at HK midnight on the 1st — only rows in the current window count.
 */
export function isInCurrentHongKongMonth(sentAt, referenceDate = new Date()) {
  if (!sentAt) return false;
  const t = new Date(sentAt).getTime();
  if (Number.isNaN(t)) return false;
  const start = getHongKongMonthStart(referenceDate).getTime();
  const end = getHongKongMonthEnd(referenceDate).getTime();
  return t >= start && t < end;
}

export function getYesterdayHongKongDateString(date = new Date()) {
  const yesterday = new Date(getHongKongDayStart(date).getTime() - MS_PER_DAY);
  return getHongKongDateString(yesterday);
}

/** Monday 00:00 Hong Kong for the week containing `date`, as UTC ISO. */
export function getStartOfWeekHongKongIso(date = new Date()) {
  const hkNow = new Date(date.getTime() + HK_OFFSET_MS);
  const daysSinceMonday = (hkNow.getUTCDay() + 6) % 7;
  const hkMonday = new Date(Date.UTC(
    hkNow.getUTCFullYear(),
    hkNow.getUTCMonth(),
    hkNow.getUTCDate() - daysSinceMonday,
  ));
  return new Date(hkMonday.getTime() - HK_OFFSET_MS).toISOString();
}
