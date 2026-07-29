/**
 * Lightweight client product analytics via PostHog (no-op when unavailable).
 */

export function captureProductEvent(event, properties = {}) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.posthog?.capture === 'function') {
      window.posthog.capture(event, properties);
    }
  } catch {
    /* analytics must never break product flows */
  }
}

export const MATCH_WHISPER_EVENTS = {
  send: 'match_whisper_send',
  reply: 'match_whisper_reply',
  convertToPassport: 'match_whisper_convert_to_passport',
};
