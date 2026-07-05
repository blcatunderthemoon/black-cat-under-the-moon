/**
 * Mirror Mode v3 — trait scoring, cat mapping, tension detection.
 */

import {
  MIRROR_PSYCH_QUESTIONS_V3,
  MIRROR_V3_TENSION_RULES,
} from './mirror-questions-v3.js';

export const SCORING_VERSION_V3 = 'v3_trait';

export const TRAIT_KEYS = [
  'autonomy',
  'validation',
  'emotional_resonance',
  'predictability',
  'expressiveness',
  'commitment',
];

export const TRAIT_LABELS = {
  autonomy: { label: '自主需求', color: '#9a72d0', glow: '#c4a8ff', hint: '需要個人空間，自己作主、不被管束' },
  validation: { label: '確認需求', color: '#c45a82', glow: '#ff8fb8', hint: '需要被看見、被肯定與回應' },
  emotional_resonance: { label: '共鳴需求', color: '#2aa8be', glow: '#4de8ff', hint: '需要深層情感連結與被理解' },
  predictability: { label: '穩定需求', color: '#2db86a', glow: '#6dff9f', hint: '需要節奏可預期、關係有安全感' },
  expressiveness: { label: '表達需求', color: '#c49228', glow: '#ffd966', hint: '需要說出來、被聽見與被理解' },
  commitment: { label: '承諾需求', color: '#5289e0', glow: '#9ec0ff', hint: '需要明確的關係方向與共同投入' },
};

export const TYPE_ORDER = ['solitary', 'sunny', 'mystical', 'sentinel'];

export const CAT_PROTOTYPES = {
  // Calibrated 2026-07-04 (medoid v3): 4^10 → 24.8/25.0/25.0/25.2%; 50-profile 50/50.
  // Re-run: node scripts/calibrate-mirror-v3-prototypes.js
  solitary: { autonomy: 15, validation: 5, emotional_resonance: 4, predictability: 6, expressiveness: 3, commitment: 4 },
  sunny: { autonomy: 0, validation: 8, emotional_resonance: 2, predictability: 7, expressiveness: 7, commitment: 6 },
  mystical: { autonomy: 7, validation: 4, emotional_resonance: 15, predictability: 2, expressiveness: 1, commitment: 1 },
  sentinel: { autonomy: 6, validation: 2, emotional_resonance: 1, predictability: 13, expressiveness: 4, commitment: 5 },
};

const SHADOW_DISTANCE_THRESHOLD = 6;

export function emptyTraitScores() {
  return Object.fromEntries(TRAIT_KEYS.map((k) => [k, 0]));
}

export function findOptionDef(questions, field, optionKey) {
  const q = questions.find((item) => item.field === field);
  if (!q?.optionDefs) return null;
  return q.optionDefs.find((o) => o.key === optionKey) || null;
}

export function computeTraitScores(answers, psychQuestions = MIRROR_PSYCH_QUESTIONS_V3) {
  const scores = emptyTraitScores();
  psychQuestions.forEach((q) => {
    const key = answers[q.field];
    if (!key) return;
    const opt = q.optionDefs?.find((o) => o.key === key);
    if (!opt?.traits) return;
    Object.entries(opt.traits).forEach(([trait, delta]) => {
      if (trait in scores) scores[trait] += delta;
    });
  });
  return scores;
}

function catDistance(traitScores, catKey) {
  const proto = CAT_PROTOTYPES[catKey];
  if (!proto) return Infinity;
  return TRAIT_KEYS.reduce((sum, trait) => {
    const diff = (traitScores[trait] || 0) - (proto[trait] || 0);
    return sum + diff * diff;
  }, 0);
}

export function traitToCat(traitScores) {
  const sorted = TYPE_ORDER
    .map((cat) => ({ cat, dist: catDistance(traitScores, cat) }))
    .sort((a, b) => a.dist - b.dist);

  const mainType = sorted[0]?.cat || 'solitary';
  const second = sorted[1];
  const shadowType =
    second && second.dist - sorted[0].dist <= SHADOW_DISTANCE_THRESHOLD
      ? second.cat
      : null;

  return { mainType, shadowType, catDistances: sorted };
}

/** Legacy-style cat scores from trait→cat similarity (for bars fallback / forum compat) */
export function traitScoresToMirrorScores(traitScores) {
  const totalTrait = Object.values(traitScores).reduce((a, b) => a + b, 0) || 1;
  const scores = { solitary: 0, sunny: 0, mystical: 0, sentinel: 0 };

  TYPE_ORDER.forEach((cat) => {
    const proto = CAT_PROTOTYPES[cat];
    let sim = 0;
    TRAIT_KEYS.forEach((trait) => {
      const userVal = traitScores[trait] || 0;
      const protoVal = proto[trait] || 0;
      sim += Math.min(userVal, protoVal);
    });
    scores[cat] = Math.round((sim / totalTrait) * 20);
  });

  const sum = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const scale = 20 / sum;
  TYPE_ORDER.forEach((cat) => {
    scores[cat] = Math.round(scores[cat] * scale);
  });

  return scores;
}

export function distributeIntegerPercentages(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return weights.map(() => 0);
  const raw = weights.map((w) => (w / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const pcts = [...floors];
  for (let k = 0; k < remainder; k += 1) {
    pcts[order[k % order.length].i] += 1;
  }
  return pcts;
}

/** All scored traits as % shares that sum to 100. */
export function getTraitBars(traitScores) {
  const sorted = TRAIT_KEYS
    .filter((k) => (traitScores[k] || 0) > 0)
    .sort((a, b) => (traitScores[b] || 0) - (traitScores[a] || 0));
  if (!sorted.length) return [];
  const pcts = distributeIntegerPercentages(sorted.map((k) => traitScores[k] || 0));
  return sorted.map((k, i) => ({
    key: k,
    pct: pcts[i],
    label: TRAIT_LABELS[k]?.label || k,
    color: TRAIT_LABELS[k]?.color || '#bd93f9',
    glow: TRAIT_LABELS[k]?.glow || TRAIT_LABELS[k]?.color || '#bd93f9',
    hint: TRAIT_LABELS[k]?.hint || '',
  }));
}

/** @deprecated Prefer getTraitBars — kept for callers expecting top-N slice. */
export function getTopTraitBars(traitScores, limit = 3) {
  return getTraitBars(traitScores).slice(0, limit);
}

export function detectTensions(answers, rules = MIRROR_V3_TENSION_RULES) {
  const out = [];
  rules.forEach((rule) => {
    try {
      if (rule.when(answers)) {
        out.push({ id: rule.id, copy_zh: rule.copy_zh });
      }
    } catch {
      /* skip */
    }
  });
  return out;
}

export function computeMirrorResultV3(answers, psychQuestions = MIRROR_PSYCH_QUESTIONS_V3) {
  const traitScores = computeTraitScores(answers, psychQuestions);
  const { mainType, shadowType } = traitToCat(traitScores);
  const mirrorScores = traitScoresToMirrorScores(traitScores);
  const traitBars = getTraitBars(traitScores);
  const tensions = detectTensions(answers);

  return {
    scoring_version: SCORING_VERSION_V3,
    trait_scores: traitScores,
    mirror_type: mainType,
    shadow_type: shadowType,
    mirror_scores: mirrorScores,
    trait_bars: traitBars,
    tension_narratives: tensions,
  };
}

/** Seeded shuffle for stable option order per session + question index */
export function shuffleOptionDefs(optionDefs, seed) {
  const arr = optionDefs.slice();
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function isTraitQuestion(q) {
  return q?.type === 'trait_single' && Array.isArray(q.optionDefs);
}
