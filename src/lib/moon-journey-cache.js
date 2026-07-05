/**
 * Session-scoped cache for Moon Journey — instant forum sidebar on revisit.
 */

import { getHongKongDateString } from './moon-journey.js';

const CACHE_KEY = 'bcutm_moon_journey_cache';

/**
 * @returns {{ journey: object, hkDate: string, at: number } | null}
 */
export function readMoonJourneyCacheEntry(userId) {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.journey || parsed.userId !== userId) return null;
    return {
      journey: parsed.journey,
      hkDate: parsed.hkDate || null,
      at: parsed.at || 0,
    };
  } catch {
    return null;
  }
}

export function readMoonJourneyCache(userId) {
  return readMoonJourneyCacheEntry(userId)?.journey ?? null;
}

export function writeMoonJourneyCache(userId, journey) {
  if (typeof window === 'undefined' || !userId || !journey) return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        v: 1,
        userId,
        journey,
        hkDate: getHongKongDateString(),
        at: Date.now(),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearMoonJourneyCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Skip meta moon-journey fetch when user already checked in today (HK). */
export function shouldSkipMoonJourneyRefresh(entry) {
  if (!entry?.journey) return false;
  if (entry.hkDate !== getHongKongDateString()) return false;
  return !!entry.journey.checked_in_today;
}

/**
 * Prefer cached journey when checked-in today to avoid UI reload flash.
 * Still accepts fresher EXP / streak from server when earned elsewhere.
 */
export function resolveMoonJourneyUpdate(entry, incoming) {
  if (!incoming) return entry?.journey ?? null;
  if (!entry?.journey) return incoming;
  if (!shouldSkipMoonJourneyRefresh(entry)) return incoming;

  const cached = entry.journey;
  if ((incoming.exp ?? 0) > (cached.exp ?? 0)) return incoming;
  if ((incoming.checkin_streak ?? 0) > (cached.checkin_streak ?? 0)) return incoming;
  if (incoming.checked_in_today && !cached.checked_in_today) return incoming;
  return cached;
}
