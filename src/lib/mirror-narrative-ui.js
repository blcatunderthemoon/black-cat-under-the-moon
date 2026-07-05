/** Shared Mirror Card narrative section labels (game UI voice). */
import { MIRROR_HEROES } from './mirror-narratives/data/heroes.js';

export { MIRROR_HEROES };

export const MIRROR_NARRATIVE_LABELS = {
  log: { zh: '鏡像觀測' },
  warn: { zh: '黑貓警戒' },
  moon: { zh: '月光備忘' },
};

/** 黑貓警戒三段 — 中文 only */
export const MIRROR_WARNING_STEP_LABELS = {
  trigger: '觸發',
  reaction: '反應',
  recovery: '修補',
};

/** Join \\n-split copy into one flowing sentence for card display. */
export function joinMirrorText(text) {
  if (!text) return '';
  return String(text).replace(/\s*\n+\s*/g, '').trim();
}

/** Split moonlight into lead + softer tail at first sentence break. */
export function splitMoonWhisperCopy(text) {
  const joined = joinMirrorText(text);
  if (!joined) return { lead: '', tail: '' };
  const breakAt = joined.indexOf('。');
  if (breakAt === -1) return { lead: joined, tail: '' };
  const tail = joined.slice(breakAt + 1).trim();
  return { lead: joined.slice(0, breakAt + 1), tail };
}

/** @param {string|null|undefined} mirrorType */
export function getMirrorHero(mirrorType) {
  return MIRROR_HEROES[mirrorType] || MIRROR_HEROES.sunny;
}
