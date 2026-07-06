/**
 * Session-scoped cache for mirror card API — instant account + public card on revisit.
 */

const ME_CACHE_KEY = 'bcutm_mirror_card_me_cache';
const SLUG_CACHE_KEY = 'bcutm_mirror_card_slug_cache';

export function readMirrorCardMeCache(userId) {
  if (typeof window === 'undefined' || !userId) return undefined;
  try {
    const raw = sessionStorage.getItem(ME_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed?.userId !== userId) return undefined;
    return parsed.card ?? null;
  } catch {
    return undefined;
  }
}

export function writeMirrorCardMeCache(userId, card) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    sessionStorage.setItem(
      ME_CACHE_KEY,
      JSON.stringify({ v: 1, userId, card: card ?? null, at: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readMirrorCardSlugCache(slug) {
  if (typeof window === 'undefined' || !slug) return undefined;
  try {
    const raw = sessionStorage.getItem(SLUG_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const entry = parsed?.cards?.[slug];
    if (!entry?.data) return undefined;
    return entry.data;
  } catch {
    return undefined;
  }
}

export function writeMirrorCardSlugCache(slug, data) {
  if (typeof window === 'undefined' || !slug || !data) return;
  try {
    const raw = sessionStorage.getItem(SLUG_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : { v: 1, cards: {} };
    if (!parsed.cards || typeof parsed.cards !== 'object') parsed.cards = {};
    parsed.cards[slug] = { data, at: Date.now() };
    const keys = Object.keys(parsed.cards);
    if (keys.length > 12) {
      keys
        .sort((a, b) => (parsed.cards[a]?.at || 0) - (parsed.cards[b]?.at || 0))
        .slice(0, keys.length - 12)
        .forEach((k) => { delete parsed.cards[k]; });
    }
    sessionStorage.setItem(SLUG_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* quota / private mode */
  }
}

export function clearMirrorCardCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ME_CACHE_KEY);
    sessionStorage.removeItem(SLUG_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
