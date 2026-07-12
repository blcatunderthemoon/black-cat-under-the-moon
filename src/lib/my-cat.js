/**
 * My Cat (月光小貓) — shared constants & pure helpers.
 * Client-safe: no server imports. Server ops live in my-cat-server.js.
 * Spec: docs/MY-CAT-GAME-DESIGN.md
 */

export const MY_CAT_PATH = '/my-cat';

const ASSET_ROOT = '/catset_extra_assets';

/**
 * skin → family / meow mapping (§7.1, §8.1).
 * cat01–04 = four Mirror families (shop purchase, Phase 2);
 * cat05 = default black kitten, free forever.
 */
export const CAT_SKIN_CONFIG = {
  cat01: { meow: `${ASSET_ROOT}/meow1.mp3`, meowId: 1, mirrorType: 'solitary', familyZh: '獨處貓家族', gifPrefix: 'cat' },
  cat02: { meow: `${ASSET_ROOT}/meow2.mp3`, meowId: 2, mirrorType: 'sunny',    familyZh: '暖陽貓家族', gifPrefix: 'cat02' },
  cat03: { meow: `${ASSET_ROOT}/meow3.mp3`, meowId: 3, mirrorType: 'mystical', familyZh: '秘境貓家族', gifPrefix: 'cat03' },
  cat04: { meow: `${ASSET_ROOT}/meow4.mp3`, meowId: 4, mirrorType: 'sentinel', familyZh: '守護貓家族', gifPrefix: 'cat04' },
  cat05: { meow: `${ASSET_ROOT}/meow5.mp3`, meowId: 5, mirrorType: null,       familyZh: '小黑貓',     gifPrefix: 'cat05' },
};

export const DEFAULT_SKIN_ID = 'cat05';

/* Shop economics (§7.1) — used in Phase 2, constants defined now. */
export const CAT_SHOP_UNLOCK_COST = 50;
export const CAT_PRICE_FAMILY = 80;
export const CAT_PRICE_OTHER = 150;

export function getCatPrice(mirrorType, targetSkinId) {
  if (targetSkinId === DEFAULT_SKIN_ID) return 0;
  const target = CAT_SKIN_CONFIG[targetSkinId]?.mirrorType;
  return target === mirrorType ? CAT_PRICE_FAMILY : CAT_PRICE_OTHER;
}

/* Interaction tuning (§4) */
export const FEED_HUNGER_GAIN = 25;
export const FEED_SHARDS_GAIN = 3;
export const PET_AFFECTION_GAIN = 2;

/**
 * Tap to Meow 累進冷卻（§4.1）。
 * 陣列 index = 今日已摸次數；即：第 1 次即時（0 分），
 * 之後要等 3 → 15 → 30 → 60 分鐘先可以再摸。摸滿 5 次當日休息。
 */
export const PET_COOLDOWN_MINUTES = [0, 3, 15, 30, 60];
export const PET_DAILY_LIMIT = PET_COOLDOWN_MINUTES.length;

/** 摸第 (petsToday+1) 次之前要等的毫秒數。 */
export function petCooldownMs(petsToday) {
  const idx = Math.min(Math.max(0, petsToday | 0), PET_COOLDOWN_MINUTES.length - 1);
  return PET_COOLDOWN_MINUTES[idx] * 60_000;
}

/** 下次可摸的 ISO 時間；已達每日上限回傳 null。 */
export function nextPetAvailableIso(lastPetAtMs, petsToday) {
  if ((petsToday ?? 0) >= PET_DAILY_LIMIT) return null;
  const cd = petCooldownMs(petsToday ?? 0);
  if (cd === 0 || !lastPetAtMs) return new Date().toISOString();
  return new Date(lastPetAtMs + cd).toISOString();
}

/* Decay (§3.2) */
export const HUNGER_DECAY_PER_DAY = 8;
export const HUNGER_FLOOR = 20;
export const AFFECTION_DECAY_PER_3_DAYS = 5;
export const AFFECTION_FLOOR = 30;

/* Animations at 12fps; everything else is 8fps (matches asset filenames). */
const FPS12_ANIMS = new Set(['pounce', 'stretch', 'tailwack']);

/** GIF URL for a skin + animation, e.g. getCatAnimUrl('cat05', 'eat'). */
export function getCatAnimUrl(skinId, anim) {
  const cfg = CAT_SKIN_CONFIG[skinId] || CAT_SKIN_CONFIG[DEFAULT_SKIN_ID];
  const fps = FPS12_ANIMS.has(anim) ? 12 : 8;
  return `${ASSET_ROOT}/catset_extra_gifs/${skinId}_gifs/${cfg.gifPrefix}_${anim}_${fps}fps.gif`;
}

/**
 * Spritesheet playback (CatSprite renders strips via CSS steps()).
 * Frame counts come from the strip filenames; fps is our own pacing —
 * deliberately slower than the source GIFs (8/12fps) for a calmer cat.
 */
export const CAT_ANIM_META = {
  buff:              { frames: 19, fps: 5 },
  crouch_slowblink:  { frames: 16, fps: 5 },
  crouch_yawn:       { frames: 16, fps: 5 },
  eat:               { frames: 8,  fps: 5 },
  groom:             { frames: 32, fps: 5 },
  idle_slowblink:    { frames: 16, fps: 5 },
  idle_yawn:         { frames: 16, fps: 5 },
  knead:             { frames: 12, fps: 5 },
  liedown_circle:    { frames: 10, fps: 5 },
  pawing:            { frames: 16, fps: 5 },
  poop:              { frames: 18, fps: 5 },
  pounce:            { frames: 12, fps: 8 },
  sit_slowblink:     { frames: 16, fps: 5 },
  sit_yawn:          { frames: 16, fps: 5 },
  sniff:             { frames: 8,  fps: 5 },
  standup:           { frames: 3,  fps: 5 },
  stretch:           { frames: 23, fps: 8 },
  tailup_buttwiggle: { frames: 28, fps: 5 },
  tailwack:          { frames: 7,  fps: 6 },
};

const DEFAULT_ANIM = 'idle_slowblink';

export function getCatAnimMeta(anim) {
  return CAT_ANIM_META[anim] || CAT_ANIM_META[DEFAULT_ANIM];
}

/** Strip PNG URL, e.g. cat05_spritesheets/cat05_eat_strip8.png */
export function getCatStripUrl(skinId, anim) {
  const cfg = CAT_SKIN_CONFIG[skinId] || CAT_SKIN_CONFIG[DEFAULT_SKIN_ID];
  const key = CAT_ANIM_META[anim] ? anim : DEFAULT_ANIM;
  const { frames } = getCatAnimMeta(key);
  return `${ASSET_ROOT}/catset_extra_spritesheets/${skinId}_spritesheets/${cfg.gifPrefix}_${key}_strip${frames}.png`;
}

/** Duration of one playback loop in ms (optionally several loops). */
export function getCatAnimDurationMs(anim, loops = 1) {
  const { frames, fps } = getCatAnimMeta(anim);
  return Math.round((frames / fps) * 1000 * loops);
}

export function getCatMeowUrl(skinId) {
  return (CAT_SKIN_CONFIG[skinId] || CAT_SKIN_CONFIG[DEFAULT_SKIN_ID]).meow;
}

/**
 * Growth stage (§3.3).
 * @returns {'kitten'|'juvenile'|'adult'|'hybrid'}
 */
export function getGrowthStage({ soul = 0, moonLevel = 1, hasMirror = false, hasShadow = false }) {
  if (soul >= 80 && hasShadow) return 'hybrid';
  if (soul >= 60 && hasMirror) return 'adult';
  if (soul >= 25 || moonLevel >= 2) return 'juvenile';
  return 'kitten';
}

export const GROWTH_STAGE_LABELS = {
  kitten: '幼崽',
  juvenile: '少年貓',
  adult: '成貓',
  hybrid: '混血形態',
};

/**
 * Lazy decay applied on read (§3.2).
 * hunger: −8 per missed HK day since last fed (floor 20).
 * affection: −5 per full 3 days since last pet (floor 30).
 * daysSinceFed / daysSincePet are whole days (already computed by caller).
 */
export function applyStatDecay({ hunger, affection, daysSinceFed, daysSincePet }) {
  let nextHunger = hunger;
  if (daysSinceFed > 0) {
    nextHunger = Math.max(HUNGER_FLOOR, hunger - daysSinceFed * HUNGER_DECAY_PER_DAY);
    // Never raise a value that is already below the floor.
    if (hunger < HUNGER_FLOOR) nextHunger = hunger;
  }

  let nextAffection = affection;
  const decaySteps = Math.floor((daysSincePet ?? 0) / 3);
  if (decaySteps > 0) {
    nextAffection = Math.max(AFFECTION_FLOOR, affection - decaySteps * AFFECTION_DECAY_PER_3_DAYS);
    if (affection < AFFECTION_FLOOR) nextAffection = affection;
  }

  return { hunger: nextHunger, affection: nextAffection };
}

export function clampStat(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
