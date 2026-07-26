/**
 * Moonlight Gatherings — client-safe time / phase helpers.
 *
 * IMPORTANT: Keep this module free of server-only imports
 * (server-auth, permissions, DB clients, etc.). UI components may import it.
 * Server business logic lives in gatherings.js and re-exports these helpers.
 */

import { HK_TZ } from './hong-kong-time.js';

export const GATHERING_DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
/** Max span from starts_at → ends_at (hosts pick a time period). */
export const GATHERING_MAX_DURATION_MS = 12 * 60 * 60 * 1000;

/** Display-only phase keys (DB still uses open/full/completed/cancelled). */
export const GATHERING_DISPLAY_STATUS = {
  open: { key: 'open', label: '招募中' },
  full: { key: 'full', label: '已滿額' },
  ongoing: { key: 'ongoing', label: '進行中' },
  completed: { key: 'completed', label: '已結束' },
  cancelled: { key: 'cancelled', label: '已取消' },
};

export function formatGatheringHkTime(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('zh-HK', {
      timeZone: HK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function formatGatheringHkClock(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('zh-HK', {
      timeZone: HK_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function gatheringHkDateParts(iso) {
  if (!iso) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: HK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(iso));
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return null;
  }
}

/**
 * Human time period for cards / detail, e.g. "26/07/2026 (週日) 14:00–16:00".
 * Cross-day spans keep both full stamps.
 */
export function formatGatheringHkTimeRange(startsAt, endsAt) {
  const startLabel = formatGatheringHkTime(startsAt);
  if (!startLabel) return '';
  if (!endsAt) return startLabel;
  const endMs = new Date(endsAt).getTime();
  const startMs = new Date(startsAt).getTime();
  if (Number.isNaN(endMs) || endMs <= startMs) return startLabel;

  const sameDay = gatheringHkDateParts(startsAt) === gatheringHkDateParts(endsAt);
  if (sameDay) {
    const endClock = formatGatheringHkClock(endsAt);
    return endClock ? `${startLabel}–${endClock}` : startLabel;
  }
  const endLabel = formatGatheringHkTime(endsAt);
  return endLabel ? `${startLabel} – ${endLabel}` : startLabel;
}

export function getGatheringEndMs(gathering) {
  if (!gathering) return NaN;
  if (gathering.ends_at) {
    const end = new Date(gathering.ends_at).getTime();
    if (!Number.isNaN(end)) return end;
  }
  if (gathering.starts_at) {
    const start = new Date(gathering.starts_at).getTime();
    if (!Number.isNaN(start)) return start + GATHERING_DEFAULT_DURATION_MS;
  }
  return NaN;
}

export function hasGatheringStarted(gathering, now = new Date()) {
  if (!gathering?.starts_at) return false;
  const start = new Date(gathering.starts_at).getTime();
  return !Number.isNaN(start) && start <= now.getTime();
}

export function isGatheringEnded(gathering, now = new Date()) {
  if (!gathering) return false;
  if (gathering.status === 'completed') return true;
  const end = getGatheringEndMs(gathering);
  return !Number.isNaN(end) && end <= now.getTime();
}

/** True while between starts_at and ends_at (and not cancelled/completed). */
export function isGatheringOngoing(gathering, now = new Date()) {
  if (!gathering) return false;
  if (gathering.status === 'cancelled' || gathering.status === 'completed') return false;
  return hasGatheringStarted(gathering, now) && !isGatheringEnded(gathering, now);
}

/**
 * UI badge key/label. Prefer this over raw DB status so "進行中" / "已結束"
 * show while status is still open/full until lazy completion writes.
 */
export function getGatheringDisplayStatus(gathering, now = new Date()) {
  if (!gathering) return GATHERING_DISPLAY_STATUS.open;
  if (gathering.status === 'cancelled') return GATHERING_DISPLAY_STATUS.cancelled;
  if (gathering.status === 'completed' || isGatheringEnded(gathering, now)) {
    return GATHERING_DISPLAY_STATUS.completed;
  }
  if (hasGatheringStarted(gathering, now)) return GATHERING_DISPLAY_STATUS.ongoing;
  if (gathering.status === 'full') return GATHERING_DISPLAY_STATUS.full;
  return GATHERING_DISPLAY_STATUS.open;
}

/** True when guests may still apply (open + not started). */
export function isGatheringAcceptingApplications(gathering, now = new Date()) {
  if (!gathering || gathering.status !== 'open') return false;
  if (hasGatheringStarted(gathering, now) || isGatheringEnded(gathering, now)) return false;
  return true;
}
