/**
 * src/lib/content-filter.js
 * Backend content moderation for Drift Bottle platform.
 *
 * Returns { blocked: boolean, crisis: boolean }
 * Call filterContent() before any user-submitted DB insert.
 *
 * Design philosophy:
 * - CRISIS_WORDS trigger a warm crisis intervention banner (HTTP 451), not a cold error.
 * - BLOCK_WORDS are hard-blocked (HTTP 400). Deliberately narrow to avoid over-filtering.
 * - Political/NSL content is NOT filtered here by keyword — context-dependent language
 *   is better handled by the report + manual review pipeline to avoid false positives.
 */

// ── Crisis keywords (self-harm / suicide) ──────────────────────────────────
// Triggers warm banner with local helpline numbers instead of a generic error.
const CRISIS_WORDS = [
  '自殺', '想死', '去死', '燒炭', '跳樓', '吞藥',
  '割腕', '割脈', '自殘', '輕生', '求死',
  '不想活', '唔想活', '唔想再活', '結束生命',
  '了結生命', '了結自己', '了結一生',
  '消失算了', '死咗算', '一了百了',
];

// ── Blocked content ─────────────────────────────────────────────────────────
// Adult/trafficking, extreme profanity (tier-1 only), spam URL fragments.
const BLOCK_WORDS = [
  // Adult / sexual services
  '援交', '援助交際', '包養', '性交易', '賣淫', '嫖妓', '叫雞',
  '一夜情服務', '找炮友',
  // Tier-1 Cantonese profanity (not blocking common venting language)
  '屌你老母', '仆你個街', '屌你老母',
  // Obvious spam link fragments
  'bit.ly/', 'tinyurl.com', 't.me/', 'wa.me/',
];

/**
 * @param {string} text
 * @returns {{ blocked: boolean, crisis: boolean }}
 */
export function filterContent(text) {
  if (!text || typeof text !== 'string') return { blocked: false, crisis: false };

  // Normalise: lowercase, collapse whitespace, strip zero-width chars
  const normalized = text
    .toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
    .replace(/\s+/g, '');

  for (const word of CRISIS_WORDS) {
    if (normalized.includes(word.toLowerCase())) {
      return { blocked: true, crisis: true };
    }
  }

  for (const word of BLOCK_WORDS) {
    if (normalized.includes(word.toLowerCase())) {
      return { blocked: true, crisis: false };
    }
  }

  return { blocked: false, crisis: false };
}
