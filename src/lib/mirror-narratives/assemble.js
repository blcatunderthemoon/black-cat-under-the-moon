/**
 * Mirror Card narrative assembly — fixed worldview + dynamic modules (v4).
 */

import { PERSONALITY_TYPES } from '../mirror-personality.js';
import { TRAIT_KEYS, TYPE_ORDER } from '../mirror-scoring-v3.js';
import { INSIGHTS } from './data/insights.js';
import { WARNINGS, Q9_TRIGGER_KEYS } from './data/warnings.js';
import { MISREAD } from './data/misread.js';
import { MOONLIGHT, MOONLIGHT_SHADOW } from './data/moonlight.js';

/** @typedef {{ key: string, score: number }} RankedTrait */

/**
 * @param {Record<string, number>|null|undefined} traitScores
 * @returns {RankedTrait[]}
 */
export function rankTraits(traitScores) {
  if (!traitScores) return [];
  return TRAIT_KEYS.map((key) => ({ key, score: traitScores[key] || 0 }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || TRAIT_KEYS.indexOf(a.key) - TRAIT_KEYS.indexOf(b.key));
}

/**
 * @param {Record<string, string>|null|undefined} map
 * @param {string[]} keys
 * @returns {string|null}
 */
function pickFromMap(map, keys) {
  if (!map) return null;
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (k && map[k]) return map[k];
  }
  return map._default || null;
}

/**
 * @param {string} seed
 * @param {number} count
 * @returns {number}
 */
function stablePickIndex(seed, count) {
  if (!count) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % count;
}

/**
 * @param {string} mirrorType
 * @param {RankedTrait[]} ranked
 * @returns {string|null}
 */
function pickInsight(mirrorType, ranked) {
  const family = INSIGHTS[mirrorType];
  if (!family || !ranked.length) return family?._default || null;

  const primary = ranked[0].key;
  const secondary = ranked[1]?.key;
  const primaryMap = family.byPrimary?.[primary];
  const insight = pickFromMap(primaryMap, [secondary, '_default']);
  return insight || family._default || null;
}

/**
 * @param {string} mirrorType
 * @param {RankedTrait[]} ranked
 * @param {Record<string, string>|null|undefined} answers
 * @returns {{ trigger: string, behaviour: string, recovery: string }|null}
 */
function pickWarning(mirrorType, ranked, answers) {
  const family = WARNINGS[mirrorType];
  if (!family || !ranked.length) return null;

  const primary = ranked[0].key;
  const lowest = ranked[ranked.length - 1]?.key;
  const q9 = answers?.m_q9;
  const q9Key = q9 && Q9_TRIGGER_KEYS[q9] ? q9 : null;

  const recoveryRanked = ranked
    .filter((t) => t.key === 'expressiveness' || t.key === 'emotional_resonance')
    .sort((a, b) => b.score - a.score);
  const recoveryKey = recoveryRanked[0]?.key || secondaryFallback(ranked, primary);

  const trigger = pickFromMap(family.trigger, [q9Key, lowest, primary, '_default']);
  const behaviour = pickFromMap(family.behaviour, [primary, lowest, '_default']);
  const recovery = pickFromMap(family.recovery, [recoveryKey, primary, '_default']);

  if (!trigger || !behaviour || !recovery) return null;
  return { trigger, behaviour, recovery };
}

/**
 * Berserk steps for RPG-style card UI.
 * @param {{ trigger: string, behaviour: string, recovery: string }|null} w
 * @returns {{ trigger: string, reaction: string, recovery: string }|null}
 */
export function formatWarningSteps(w) {
  if (!w?.trigger) return null;
  return {
    trigger: w.trigger.replace(/^當/, ''),
    reaction: (w.behaviour || '').replace(/^你會/, ''),
    recovery: w.recovery || '',
  };
}

/** @deprecated Use formatWarningSteps */
export function formatWarningRows(w) {
  const steps = formatWarningSteps(w);
  if (!steps) return null;
  const t = steps.trigger.replace(/。$/, '');
  const r = steps.reaction.replace(/。$/, '');
  const burst = r ? `${t} → ${r}。` : steps.trigger;
  return { burst, recovery: steps.recovery };
}

/** @param {RankedTrait[]} ranked @param {string} primary */
function secondaryFallback(ranked, primary) {
  return ranked.find((t) => t.key !== primary)?.key || primary;
}

/**
 * @param {string} mirrorType
 * @param {string|null|undefined} shadowType
 * @param {Record<string, number>|null|undefined} traitScores
 * @returns {string|null}
 */
function pickMoonlight(mirrorType, shadowType, traitScores) {
  const shadowKey = shadowType ? `${mirrorType}+${shadowType}` : null;
  if (shadowKey && MOONLIGHT_SHADOW[shadowKey]) {
    return MOONLIGHT_SHADOW[shadowKey];
  }

  const variants = MOONLIGHT[mirrorType];
  if (!variants?.length) return null;

  const seed = TYPE_ORDER.map((k) => `${k}:${traitScores?.[k] || 0}`).join('|');
  return variants[stablePickIndex(seed, variants.length)];
}

/**
 * Legacy fallback when v3 trait data unavailable.
 * @param {string} mirrorType
 * @returns {import('./assemble.js').MirrorNarrative}
 */
export function buildLegacyNarrative(mirrorType) {
  const p = PERSONALITY_TYPES[mirrorType] || {};
  return {
    worldview: p.desc || '',
    insight: null,
    misread: MISREAD[mirrorType] || null,
    warning: null,
    warningLegacy: p.warning || '',
    moonlight: null,
    dynamic: false,
  };
}

/**
 * @typedef {Object} MirrorNarrative
 * @property {string} worldview
 * @property {string|null} insight
 * @property {string|null} misread
 * @property {{ trigger: string, behaviour: string, recovery: string }|null} warning
 * @property {string} [warningLegacy]
 * @property {string|null} moonlight
 * @property {boolean} dynamic
 */

/**
 * @param {Object} opts
 * @param {string} opts.mirrorType
 * @param {string|null} [opts.shadowType]
 * @param {Record<string, number>|null} [opts.traitScores]
 * @param {Record<string, string>|null} [opts.answers]
 * @param {string} [opts.scoringVersion]
 * @param {boolean} [opts.includeMisread]
 * @param {boolean} [opts.includeMoonlight]
 * @returns {MirrorNarrative}
 */
export function assembleNarrative(opts) {
  const {
    mirrorType,
    shadowType = null,
    traitScores = null,
    answers = null,
    scoringVersion = '',
    includeMisread = true,
    includeMoonlight = false,
  } = opts;

  const p = PERSONALITY_TYPES[mirrorType] || {};
  const isV3 = scoringVersion === 'v3_trait' && traitScores && Object.keys(traitScores).length > 0;

  if (!isV3) {
    const legacy = buildLegacyNarrative(mirrorType);
    if (!includeMisread) legacy.misread = null;
    return legacy;
  }

  const ranked = rankTraits(traitScores);

  return {
    worldview: p.desc || '',
    insight: pickInsight(mirrorType, ranked),
    misread: includeMisread ? (MISREAD[mirrorType] || null) : null,
    warning: pickWarning(mirrorType, ranked, answers),
    warningLegacy: p.warning || '',
    moonlight: includeMoonlight ? pickMoonlight(mirrorType, shadowType, traitScores) : null,
    dynamic: true,
  };
}
