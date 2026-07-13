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

/**
 * 靈魂值上限與成長門檻（2026-07-13 v4：更難升，體型越大需時越長）。
 * 靈魂只由「參與」得來：Mirror 性格測驗（一次性）、玩漂流瓶、Forum 互動。
 * 餵食唔再加靈魂（只回飽腹＋碎屑）。每日靈魂有上限，所以要日日返嚟參與先養得大。
 */
export const SOUL_MAX = 300;
export const GROWTH_SOUL_JUVENILE = 90;
export const GROWTH_SOUL_ADULT = 190;
export const GROWTH_SOUL_HYBRID = 290;
/**
 * 餵食唔再回靈魂（v4）。保留常數＝0 以兼容舊呼叫點。
 */
export const FEED_SOUL_GAIN = 0;
export const FEED_SOUL_GAIN_BY_STAGE = {
  kitten: 0,
  juvenile: 0,
  adult: 0,
  hybrid: 0,
};

export function getCatPrice(mirrorType, targetSkinId) {
  if (targetSkinId === DEFAULT_SKIN_ID) return 0;
  const target = CAT_SKIN_CONFIG[targetSkinId]?.mirrorType;
  return target === mirrorType ? CAT_PRICE_FAMILY : CAT_PRICE_OTHER;
}

/* Interaction tuning (§4) */
export const FEED_HUNGER_GAIN = 25;
export const FEED_SHARDS_GAIN = 3;

/**
 * 一日兩餐（2026-07-13 v5）：由「每日一次打卡」改成「早、晚各一次」。
 * 全日總獎勵維持不變（EXP +2 / 碎屑 +3），只係分兩次領，鼓勵一日返嚟兩次。
 * 時段（香港時間）：早餐 05:00–16:59；其餘（17:00 至翌日 04:59）為晚餐。
 * 每個時段各自可餵一次（以香港曆日 + 時段做冪等鍵）。
 */
export const MEAL_MORNING_START_HOUR = 5;   // 含：≥ 05:00 起為早餐
export const MEAL_EVENING_START_HOUR = 17;  // 含：≥ 17:00 起為晚餐
export const MEAL_WINDOWS = ['am', 'pm'];
export const MEAL_LABEL = { am: '早餐', pm: '晚餐' };
/** 各餐碎屑：早 +2、晚 +1（全日仍為 +3）。 */
export const FEED_SHARDS_BY_WINDOW = { am: 2, pm: 1 };

/** 由香港時 hour（0–23）判斷屬早餐（am）定晚餐（pm）。 */
export function mealWindowForHour(hkHour) {
  const h = Number(hkHour);
  return (h >= MEAL_MORNING_START_HOUR && h < MEAL_EVENING_START_HOUR) ? 'am' : 'pm';
}

/** 某餐可領嘅碎屑數。 */
export function feedShardsForWindow(win) {
  return FEED_SHARDS_BY_WINDOW[win] ?? 0;
}

/** 該餐時段下次開放嘅提示文案（給前端按鈕用）。 */
export const MEAL_NEXT_HINT = {
  am: '晚餐 17:00 後再嚟',
  pm: '早餐 05:00 後再嚟',
};
// 好感 v2：每次摸 +20 → 每日 5 次摸滿必到 100
export const PET_AFFECTION_GAIN = 20;

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

/**
 * 飽腹 v2：餵食回滿 100，之後 30 小時**線性**跌到 0。
 * 跌到 0 → 貓咪離家出走；按「召喚」等 1 小時先返嚟。
 * 太餓（< TOO_HUNGRY_THRESHOLD）→ 冇心機郁（閒置動畫停晒）。
 */
export const HUNGER_FULL = 100;
export const HUNGER_EMPTY_MS = 30 * 60 * 60 * 1000;
export const CAT_SUMMON_WAIT_MS = 60 * 60 * 1000;
export const TOO_HUNGRY_THRESHOLD = 20;

/** 由上次餵食時間戳計算現時飽腹（0–100 線性）。無記錄回傳 null（用舊制）。 */
export function computeHungerFromFedAt(lastFedAtMs, nowMs = Date.now()) {
  if (!lastFedAtMs) return null;
  const elapsed = nowMs - lastFedAtMs;
  if (elapsed <= 0) return HUNGER_FULL;
  if (elapsed >= HUNGER_EMPTY_MS) return 0;
  return Math.round(HUNGER_FULL * (1 - elapsed / HUNGER_EMPTY_MS));
}

/**
 * 好感 v2：同飽腹一樣，由上次摸摸起 30 小時**按比例**慢慢減到 0。
 * baseAffection = 上次摸摸時落盤嘅好感值。
 */
export const AFFECTION_EMPTY_MS = 30 * 60 * 60 * 1000;

export function computeAffectionFromPetAt(baseAffection, lastPetAtMs, nowMs = Date.now()) {
  const base = clampStat(baseAffection);
  if (!lastPetAtMs) return base;
  const elapsed = nowMs - lastPetAtMs;
  if (elapsed <= 0) return base;
  if (elapsed >= AFFECTION_EMPTY_MS) return 0;
  return Math.round(base * (1 - elapsed / AFFECTION_EMPTY_MS));
}

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
 * 每隻貓叫聲音量（0–1）：唔同音檔錄音大細唔一，喺呢度校正到聽感一致。
 * 獨處貓（cat01）原檔偏大聲 → 調細。
 */
export const CAT_MEOW_VOLUME = {
  cat01: 0.45,
  cat02: 1,
  cat03: 1,
  cat04: 1,
  cat05: 1,
};

export function getCatMeowVolume(skinId) {
  const v = CAT_MEOW_VOLUME[skinId];
  return typeof v === 'number' ? v : 1;
}

/**
 * Growth stage (§3.3).
 * 僅靈魂值決定體型（已移除 Moon Journey Lv 捷徑）。
 * @returns {'kitten'|'juvenile'|'adult'|'hybrid'}
 */
export function getGrowthStage({ soul = 0, hasMirror = false, hasShadow = false }) {
  if (soul >= GROWTH_SOUL_HYBRID && hasShadow) return 'hybrid';
  if (soul >= GROWTH_SOUL_ADULT && hasMirror) return 'adult';
  if (soul >= GROWTH_SOUL_JUVENILE) return 'juvenile';
  return 'kitten';
}

/** 依當前成長階段計算今次餵食應得靈魂（體型愈大愈慢）。 */
export function getFeedSoulGain(growthStage) {
  return FEED_SOUL_GAIN_BY_STAGE[growthStage] ?? FEED_SOUL_GAIN;
}

export function clampSoul(value) {
  return Math.max(0, Math.min(SOUL_MAX, Math.round(Number(value) || 0)));
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

/** Admin test account — unlimited moon shards for shop QA (§7.1). */
export const MY_CAT_UNLIMITED_SHARDS_EMAIL = 'blcatunderthemoon@gmail.com';
export const MY_CAT_UNLIMITED_SHARDS_DISPLAY = 999_999;

export function hasUnlimitedMoonShards(email) {
  return String(email || '').trim().toLowerCase() === MY_CAT_UNLIMITED_SHARDS_EMAIL;
}

export function displayMoonShards(balance, unlimited) {
  void unlimited;
  return balance ?? 0;
}
