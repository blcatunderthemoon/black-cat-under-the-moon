/**
 * PostHog analytics — public client config (project key is safe to expose in the browser).
 * Set NEXT_PUBLIC_POSTHOG_KEY in Vercel / .env.local; production stays disabled without it.
 */

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export function getPostHogKey() {
  const raw = (process.env.NEXT_PUBLIC_POSTHOG_KEY || '').trim();
  if (!raw) return '';
  // Env paste mistakes often duplicate the key across newlines — use the first token only.
  return raw.split(/\s+/)[0];
}

export function getPostHogHost() {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST).replace(/\/$/, '');
}

export function isPostHogEnabled() {
  if (process.env.NEXT_PUBLIC_POSTHOG_ENABLED === '0') return false;
  if (process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'false') return false;
  return Boolean(getPostHogKey());
}

export function getPostHogInitOptions() {
  return {
    api_host: getPostHogHost(),
    defaults: '2026-01-30',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: { maskAllInputs: true },
  };
}

/** JSON for /api/analytics/config (static HTML pages). */
export function getPublicPostHogConfig() {
  if (!isPostHogEnabled()) {
    return { enabled: false };
  }
  return {
    enabled: true,
    key: getPostHogKey(),
    host: getPostHogHost(),
    options: getPostHogInitOptions(),
  };
}
