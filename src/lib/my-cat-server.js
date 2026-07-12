/**
 * My Cat — server operations (admin client passed in, same pattern as moon-journey.js).
 * SERVER ONLY: import from API routes.
 * Spec: docs/MY-CAT-GAME-DESIGN.md §4, §5, §10
 */

import {
  DEFAULT_SKIN_ID,
  CAT_SKIN_CONFIG,
  CAT_SHOP_UNLOCK_COST,
  getCatPrice,
  FEED_SHARDS_GAIN,
  HUNGER_FULL,
  CAT_SUMMON_WAIT_MS,
  computeHungerFromFedAt,
  computeAffectionFromPetAt,
  PET_AFFECTION_GAIN,
  PET_DAILY_LIMIT,
  petCooldownMs,
  nextPetAvailableIso,
  applyStatDecay,
  clampStat,
  clampSoul,
  getGrowthStage,
  getFeedSoulGain,
  getCatMeowUrl,
  SOUL_MAX,
  hasUnlimitedMoonShards,
  displayMoonShards,
  MY_CAT_UNLIMITED_SHARDS_DISPLAY,
} from './my-cat.js';
import { pickCatLine } from './my-cat-lines.js';
import { applyFeedMilestones } from './my-cat-awards.js';
import {
  ensureUserCatRoom,
  buildRoomView,
  upsertUserCatRoom,
  isFallbackRoom,
} from './cat-room-server.js';
import {
  DEFAULT_ROOM_EQUIPPED,
  DEFAULT_ROOM_OWNED,
  getRoomItem,
} from './cat-room.js';
import { filterContent } from './content-filter.js';
import {
  performDailyCheckIn,
  buildMoonJourneySummary,
  getHongKongDateString,
} from './moon-journey.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole HK calendar days from a YYYY-MM-DD (or ISO timestamp) to today. */
function hkDaysSince(dateLike) {
  if (!dateLike) return 0;
  const refDate = getHongKongDateString(new Date(dateLike.length === 10 ? `${dateLike}T04:00:00+08:00` : dateLike));
  const today = getHongKongDateString();
  const diff = (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${refDate}T00:00:00Z`).getTime()) / MS_PER_DAY;
  return Math.max(0, Math.round(diff));
}

/** Fetch or create the user's cat row. */
export async function ensureUserCat(admin, userId) {
  const { data: existing, error } = await admin
    .from('user_cats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await admin
    .from('user_cats')
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (insertError) {
    // Concurrent creation — fetch the winner's row.
    if (insertError.code === '23505') {
      const { data: raced } = await admin
        .from('user_cats')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (raced) return raced;
    }
    throw insertError;
  }
  return created;
}

async function fetchMoonProfileRow(admin, userId) {
  const { data } = await admin
    .from('profiles')
    .select('moon_journey_exp, moon_journey_level, moon_checkin_streak, moon_last_checkin_date')
    .eq('id', userId)
    .maybeSingle();
  return data || {
    moon_journey_exp: 0,
    moon_journey_level: 1,
    moon_checkin_streak: 0,
    moon_last_checkin_date: null,
  };
}

async function fetchUserEmail(admin, userId) {
  const { data } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  return data?.email || '';
}

async function isUnlimitedShardsUser(admin, userId) {
  const email = await fetchUserEmail(admin, userId);
  return hasUnlimitedMoonShards(email);
}

/** Admin test account：餘額太低先補到 999999，之後購買會正常扣數。 */
async function ensureAdminTestShards(admin, userId, catRow) {
  if (!await isUnlimitedShardsUser(admin, userId)) return catRow;
  if ((catRow.moon_shards ?? 0) >= 1000) return catRow;
  const { data, error } = await admin
    .from('user_cats')
    .update({ moon_shards: MY_CAT_UNLIMITED_SHARDS_DISPLAY })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function fetchMirrorTypes(admin, userId) {
  const { data } = await admin
    .from('mirror_cards')
    .select('mirror_type, shadow_type')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function countPetsToday(admin, userId) {
  const todayHk = getHongKongDateString();
  const { count } = await admin
    .from('cat_care_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', 'pet')
    .like('source_id', `${todayHk}#%`);
  return count ?? 0;
}

/**
 * 現時飽腹：優先用 last_fed_at 新制（餵食回滿 100，24 小時線性跌到 0）；
 * 未有時間戳（舊資料）就用舊制曆日衰減。
 */
function currentHunger(catRow, nowMs = Date.now()) {
  const fedAtMs = catRow.last_fed_at ? new Date(catRow.last_fed_at).getTime() : 0;
  const linear = computeHungerFromFedAt(fedAtMs, nowMs);
  if (linear != null) return linear;
  const decayed = applyStatDecay({
    hunger: catRow.hunger,
    affection: catRow.affection,
    daysSinceFed: hkDaysSince(catRow.last_fed_date || catRow.created_at),
    daysSincePet: 0,
  });
  return clampStat(decayed.hunger);
}

/**
 * 現時好感（v2）：由上次摸摸（last_pet_at）起 24 小時按比例減到 0。
 * 未摸過就以 created_at 做基準。
 */
function currentAffection(catRow, nowMs = Date.now()) {
  const baseMs = catRow.last_pet_at
    ? new Date(catRow.last_pet_at).getTime()
    : (catRow.created_at ? new Date(catRow.created_at).getTime() : 0);
  return computeAffectionFromPetAt(catRow.affection, baseMs, nowMs);
}

/**
 * 離家出走狀態：飽腹 0 即出走；按「召喚」後等 CAT_SUMMON_WAIT_MS 先返嚟。
 * 返咗嚟（就算仲係 0）就可以餵食，餵完 last_fed_at 重置、summoned_at 清空。
 */
function awayState(catRow, hunger, nowMs = Date.now()) {
  const summonedAtMs = catRow.summoned_at ? new Date(catRow.summoned_at).getTime() : 0;
  const returned = summonedAtMs > 0 && nowMs >= summonedAtMs + CAT_SUMMON_WAIT_MS;
  const away = hunger <= 0 && !returned;
  const summonPending = away && summonedAtMs > 0;
  return {
    away,
    summon_pending: summonPending,
    can_summon: away && !summonPending,
    cat_returns_at: summonPending ? new Date(summonedAtMs + CAT_SUMMON_WAIT_MS).toISOString() : null,
  };
}

/**
 * Build the client-facing cat payload.
 * Decay is computed lazily from stored values + elapsed time; stored stats
 * only change on feed/pet, so this stays idempotent.
 */
function buildCatView(catRow, { moonJourney, mirror, petsToday, unlimitedShards = false }) {
  const skinId = catRow.skin_id || DEFAULT_SKIN_ID;
  const todayHk = getHongKongDateString();
  const now = Date.now();

  const hunger = currentHunger(catRow, now);
  const affection = currentAffection(catRow, now);
  const awayInfo = awayState(catRow, hunger, now);

  const growthStage = getGrowthStage({
    soul: catRow.soul,
    hasMirror: !!mirror?.mirror_type,
    hasShadow: !!mirror?.shadow_type,
  });

  return {
    skin_id: skinId,
    family_zh: CAT_SKIN_CONFIG[skinId]?.familyZh || '小黑貓',
    name: catRow.custom_name || CAT_SKIN_CONFIG[skinId]?.familyZh || '小黑貓',
    custom_name: catRow.custom_name || null,
    can_rename: !catRow.renamed_at,
    meow_url: getCatMeowUrl(skinId),
    hunger,
    affection,
    soul: clampSoul(catRow.soul),
    soul_max: SOUL_MAX,
    growth_stage: growthStage,
    moon_shards: displayMoonShards(catRow.moon_shards, unlimitedShards),
    owned_skins: catRow.owned_skins || [DEFAULT_SKIN_ID],
    cat_shop_unlocked: unlimitedShards || !!catRow.cat_shop_unlocked,
    fed_today: catRow.last_fed_date === todayHk,
    pets_today: petsToday ?? 0,
    pet_daily_limit: PET_DAILY_LIMIT,
    next_pet_available_at: nextPetAvailableIso(
      catRow.last_pet_at ? new Date(catRow.last_pet_at).getTime() : 0,
      petsToday ?? 0,
    ),
    ...awayInfo,
  };
}

/**
 * 商店解鎖 flag（sticky）：完成 Mirror 且碎屑 ≥ CAT_SHOP_UNLOCK_COST 即永久解鎖
 * （買貓後餘額跌返落去都唔會重新鎖返）。
 */
async function ensureShopUnlockFlag(admin, userId, catRow, mirror) {
  if (await isUnlimitedShardsUser(admin, userId)) {
    if (!catRow.cat_shop_unlocked) {
      const { data } = await admin
        .from('user_cats')
        .update({ cat_shop_unlocked: true })
        .eq('user_id', userId)
        .select('*')
        .single();
      return data || { ...catRow, cat_shop_unlocked: true };
    }
    return { ...catRow, cat_shop_unlocked: true };
  }
  if (catRow.cat_shop_unlocked) return catRow;
  if (!mirror?.mirror_type) return catRow;
  if ((catRow.moon_shards ?? 0) < CAT_SHOP_UNLOCK_COST) return catRow;
  const { data } = await admin
    .from('user_cats')
    .update({ cat_shop_unlocked: true })
    .eq('user_id', userId)
    .select('*')
    .single();
  return data || { ...catRow, cat_shop_unlocked: true };
}

/** 商店 payload（§7.1）：五隻貓嘅價格／擁有／裝備狀態。 */
function buildShopView(catRow, mirror, unlimitedShards = false) {
  const owned = catRow.owned_skins || [DEFAULT_SKIN_ID];
  const equipped = catRow.skin_id || DEFAULT_SKIN_ID;
  const mirrorType = mirror?.mirror_type || null;
  return {
    // 商店對所有人開放（唔再需要碎屑解鎖門檻）
    unlocked: true,
    unlock_cost: CAT_SHOP_UNLOCK_COST,
    has_mirror: !!mirrorType,
    mirror_type: mirrorType,
    moon_shards: displayMoonShards(catRow.moon_shards, unlimitedShards),
    skins: Object.keys(CAT_SKIN_CONFIG).map((skinId) => ({
      skin_id: skinId,
      family_zh: CAT_SKIN_CONFIG[skinId].familyZh,
      price: getCatPrice(mirrorType, skinId),
      owned: owned.includes(skinId),
      equipped: equipped === skinId,
      is_family: !!mirrorType && CAT_SKIN_CONFIG[skinId].mirrorType === mirrorType,
    })),
  };
}

/** Full state for GET /api/my-cat. */
export async function getMyCatState(admin, userId) {
  const unlimitedShards = await isUnlimitedShardsUser(admin, userId);
  const [rawCatRow, moonProfile, mirror, roomRow] = await Promise.all([
    ensureUserCat(admin, userId),
    fetchMoonProfileRow(admin, userId),
    fetchMirrorTypes(admin, userId),
    ensureUserCatRoom(admin, userId),
  ]);
  const toppedCatRow = await ensureAdminTestShards(admin, userId, rawCatRow);
  const catRow = await ensureShopUnlockFlag(admin, userId, toppedCatRow, mirror);
  const petsToday = await countPetsToday(admin, userId);
  const moonJourney = buildMoonJourneySummary(moonProfile);

  return {
    cat: buildCatView(catRow, { moonJourney, mirror, petsToday, unlimitedShards }),
    moon_journey: moonJourney,
    shop: buildShopView(catRow, mirror, unlimitedShards),
    room: buildRoomView(roomRow),
  };
}

/**
 * Feed = unified daily ritual (§5.2):
 * one HK calendar day → Moon Journey check-in (+2 EXP) + hunger 回滿 100 + shards +3.
 * 飽腹 v2：餵完 24 小時線性跌到 0。離家出走期間唔餵得（要先召喚等佢返嚟）。
 * Idempotent per day via last_fed_date + ledgers.
 */
export async function performCatFeed(admin, userId) {
  const unlimitedShards = await isUnlimitedShardsUser(admin, userId);
  const todayHk = getHongKongDateString();
  const catRow = await ensureUserCat(admin, userId);

  // 離家出走中 → 唔餵得，提示先召喚。
  const hungerNow = currentHunger(catRow);
  const awayInfo = awayState(catRow, hungerNow);
  if (awayInfo.away) {
    const [mirror, petsToday] = await Promise.all([
      fetchMirrorTypes(admin, userId),
      countPetsToday(admin, userId),
    ]);
    const moonProfile = await fetchMoonProfileRow(admin, userId);
    const moonJourney = buildMoonJourneySummary(moonProfile);
    return {
      away: true,
      already_fed_today: false,
      awarded: false,
      shards_gained: 0,
      error: awayInfo.summon_pending
        ? '貓咪仲喺出面未返，等埋佢先。'
        : '貓咪離家出走咗，先按「召喚」叫佢返嚟。',
      moon_journey: moonJourney,
      cat: buildCatView(catRow, { moonJourney, mirror, petsToday, unlimitedShards }),
    };
  }

  // Moon Journey check-in is itself idempotent per HK day.
  const checkin = await performDailyCheckIn(admin, userId);

  if (catRow.last_fed_date === todayHk) {
    const mirror = await fetchMirrorTypes(admin, userId);
    const petsToday = await countPetsToday(admin, userId);
    return {
      already_fed_today: true,
      awarded: false,
      shards_gained: 0,
      moon_journey: checkin.moon_journey,
      cat: buildCatView(catRow, { moonJourney: checkin.moon_journey, mirror, petsToday, unlimitedShards }),
    };
  }

  // Care ledger — the 23505 path means a concurrent feed won.
  const mirrorPre = await fetchMirrorTypes(admin, userId);
  const feedSoulForInsert = getFeedSoulGain(getGrowthStage({
    soul: catRow.soul,
    hasMirror: !!mirrorPre?.mirror_type,
    hasShadow: !!mirrorPre?.shadow_type,
  }));

  const { error: careError } = await admin
    .from('cat_care_events')
    .insert({
      user_id: userId,
      action_type: 'daily_feed',
      source_id: todayHk,
      delta_hunger: HUNGER_FULL,
      delta_soul: feedSoulForInsert,
    });
  if (careError && careError.code !== '23505') throw careError;
  const firstFeed = !careError;

  let shardsGained = 0;
  let feedSoulGained = 0;
  let nextRow = catRow;

  if (firstFeed) {
    feedSoulGained = feedSoulForInsert;

    const { error: shardError } = await admin
      .from('cat_economy_events')
      .insert({
        user_id: userId,
        action_type: 'daily_feed',
        source_id: todayHk,
        shards_delta: FEED_SHARDS_GAIN,
      });
    if (!shardError) shardsGained = FEED_SHARDS_GAIN;
    else if (shardError.code !== '23505') throw shardError;

    const { data: updated, error: updateError } = await admin
      .from('user_cats')
      .update({
        hunger: HUNGER_FULL,
        last_fed_date: todayHk,
        last_fed_at: new Date().toISOString(),
        summoned_at: null,
        moon_shards: (catRow.moon_shards ?? 0) + shardsGained,
        soul: clampSoul((catRow.soul ?? 0) + feedSoulGained),
      })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    nextRow = updated;
  } else if (catRow.last_fed_date !== todayHk) {
    // Ledger already recorded today's feed but the row is stale (e.g. an
    // earlier update failed before the schema was migrated). Heal the row so
    // fed_today is reported correctly and the feed button locks out.
    const { data: healed, error: healError } = await admin
      .from('user_cats')
      .update({
        hunger: HUNGER_FULL,
        last_fed_date: todayHk,
        last_fed_at: new Date().toISOString(),
        summoned_at: null,
      })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (healError) throw healError;
    nextRow = healed;
  }

  const mirror = mirrorPre;
  const petsToday = await countPetsToday(admin, userId);

  let bonusShards = 0;
  let bonusSoul = 0;
  if (firstFeed) {
    const mj = checkin.moon_journey || checkin;
    const milestones = await applyFeedMilestones(admin, userId, {
      streak: mj.checkin_streak ?? 0,
      leveledUp: !!checkin.leveled_up,
      level: mj.level ?? 1,
    });
    bonusShards = milestones.shards;
    bonusSoul = milestones.soul;
    if (bonusShards || bonusSoul) {
      nextRow = await ensureUserCat(admin, userId);
    }
  }

  const updatedCatRow = await ensureShopUnlockFlag(admin, userId, nextRow, mirror);

  return {
    already_fed_today: !firstFeed,
    awarded: !!checkin.awarded,
    exp_gained: checkin.awarded ? checkin.exp_gained : 0,
    leveled_up: !!checkin.leveled_up,
    shards_gained: shardsGained,
    soul_gained: feedSoulGained,
    bonus_shards: bonusShards,
    bonus_soul: bonusSoul,
    moon_journey: checkin.moon_journey,
    cat: buildCatView(updatedCatRow, { moonJourney: checkin.moon_journey, mirror, petsToday, unlimitedShards }),
  };
}

/**
 * 召喚離家出走嘅貓（飽腹 0）：記低 summoned_at，1 小時後貓咪返嚟先可以餵返。
 */
export async function performCatSummon(admin, userId) {
  const unlimitedShards = await isUnlimitedShardsUser(admin, userId);
  const catRow = await ensureUserCat(admin, userId);
  const hungerNow = currentHunger(catRow);
  const awayInfo = awayState(catRow, hungerNow);

  const buildResult = async (row, extra) => {
    const [moonProfile, mirror, petsToday] = await Promise.all([
      fetchMoonProfileRow(admin, userId),
      fetchMirrorTypes(admin, userId),
      countPetsToday(admin, userId),
    ]);
    const moonJourney = buildMoonJourneySummary(moonProfile);
    return { cat: buildCatView(row, { moonJourney, mirror, petsToday, unlimitedShards }), ...extra };
  };

  if (!awayInfo.away) {
    return buildResult(catRow, { ok: false, error: '貓咪就喺屋企，唔使召喚。' });
  }
  if (awayInfo.summon_pending) {
    return buildResult(catRow, { ok: true, already_summoned: true });
  }

  const { data: updated, error } = await admin
    .from('user_cats')
    .update({ summoned_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;

  return buildResult(updated, { ok: true });
}

export const CAT_NAME_MAX_LENGTH = 12;

/**
 * Rename the cat — one shot for now (§4.4).
 * renamed_at set on first successful rename; further attempts are rejected.
 */
export async function performCatRename(admin, userId, rawName) {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ');

  if (!name) {
    return { ok: false, error: '幫貓咪起個名先啦。' };
  }
  if (name.length > CAT_NAME_MAX_LENGTH) {
    return { ok: false, error: `名字最多 ${CAT_NAME_MAX_LENGTH} 個字。` };
  }
  const { blocked } = filterContent(name);
  if (blocked) {
    return { ok: false, error: '呢個名唔太適合，試下另一個？' };
  }

  const catRow = await ensureUserCat(admin, userId);
  if (catRow.renamed_at) {
    return { ok: false, error: '貓咪已經有名了，暫時只能改一次。', already_renamed: true };
  }

  // renamed_at IS NULL guard makes concurrent renames single-winner.
  const { data: updated, error: updateError } = await admin
    .from('user_cats')
    .update({ custom_name: name, renamed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('renamed_at', null)
    .select('*')
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) {
    return { ok: false, error: '貓咪已經有名了，暫時只能改一次。', already_renamed: true };
  }

  const [moonProfile, mirror, petsToday, unlimitedShards] = await Promise.all([
    fetchMoonProfileRow(admin, userId),
    fetchMirrorTypes(admin, userId),
    countPetsToday(admin, userId),
    isUnlimitedShardsUser(admin, userId),
  ]);
  const moonJourney = buildMoonJourneySummary(moonProfile);

  return {
    ok: true,
    cat: buildCatView(updated, { moonJourney, mirror, petsToday, unlimitedShards }),
  };
}

/**
 * Tap to Meow (§4.1): up to PET_DAILY_LIMIT taps per HK day, each +2 affection,
 * gated by an escalating cooldown (0 / 3 / 15 / 30 / 60 min between taps).
 * last_pet_at only advances on a counted tap, so blocked taps don't extend the wait.
 */
export async function performCatPet(admin, userId, { lastLine = null } = {}) {
  const unlimitedShards = await isUnlimitedShardsUser(admin, userId);
  const todayHk = getHongKongDateString();
  const catRow = await ensureUserCat(admin, userId);
  let petsToday = await countPetsToday(admin, userId);

  const now = Date.now();
  const lastPetMs = catRow.last_pet_at ? new Date(catRow.last_pet_at).getTime() : 0;

  const buildResult = async (row, extra) => {
    const [moonProfile, mirror] = await Promise.all([
      fetchMoonProfileRow(admin, userId),
      fetchMirrorTypes(admin, userId),
    ]);
    const moonJourney = buildMoonJourneySummary(moonProfile);
    const picked = pickCatLine({ affection: row.affection, lastLine });
    return {
      line: picked.line,
      line_pool: picked.pool,
      cat: buildCatView(row, { moonJourney, mirror, petsToday, unlimitedShards }),
      ...extra,
    };
  };

  // 離家出走中 — 冇貓可摸。
  const awayInfo = awayState(catRow, currentHunger(catRow, now), now);
  if (awayInfo.away) {
    return buildResult(catRow, { counted: false, away: true });
  }

  // 每日上限已滿 — 不改狀態、不重置。
  if (petsToday >= PET_DAILY_LIMIT) {
    return buildResult(catRow, { counted: false, daily_limit_reached: true });
  }

  // 累進冷卻未到 — 拒絕，但不推遲 last_pet_at。
  const cd = petCooldownMs(petsToday);
  if (cd > 0 && lastPetMs && now - lastPetMs < cd) {
    return buildResult(catRow, {
      counted: false,
      on_cooldown: true,
      next_pet_available_at: new Date(lastPetMs + cd).toISOString(),
    });
  }

  // 通過 — 記帳 + 加好感。
  const { error } = await admin
    .from('cat_care_events')
    .insert({
      user_id: userId,
      action_type: 'pet',
      source_id: `${todayHk}#${petsToday + 1}`,
      delta_affection: PET_AFFECTION_GAIN,
    });
  if (error && error.code !== '23505') throw error;
  const counted = !error;
  if (counted) petsToday += 1;
  else petsToday = await countPetsToday(admin, userId); // 併發：重新計數

  if (!counted) {
    return buildResult(catRow, { counted: false });
  }

  // 好感 v2：喺「現時（已衰減）」值上 +20，落盤並重置 24 小時衰減基準。
  // 每日 5 次 × 20 = 100 → 摸滿必到頂。
  const newAffection = clampStat(currentAffection(catRow, now) + PET_AFFECTION_GAIN);

  const { data: updated, error: updateError } = await admin
    .from('user_cats')
    .update({ affection: newAffection, last_pet_at: new Date(now).toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (updateError) throw updateError;

  return buildResult(updated, { counted: true });
}

/**
 * 購買家族貓（§7.1）：扣碎屑、追加 owned_skins、即時裝備。
 */
export async function performCatBuySkin(admin, userId, skinId) {
  if (!CAT_SKIN_CONFIG[skinId]) {
    return { ok: false, error: '唔認得呢隻貓。' };
  }
  if (skinId === DEFAULT_SKIN_ID) {
    return { ok: false, error: '小黑貓本來就免費擁有。' };
  }

  const [catRow, mirror, unlimitedShards] = await Promise.all([
    ensureUserCat(admin, userId).then((row) => ensureAdminTestShards(admin, userId, row)),
    fetchMirrorTypes(admin, userId),
    isUnlimitedShardsUser(admin, userId),
  ]);

  // 商店對所有人開放：唔再要求完成 Mirror，亦唔再需要碎屑解鎖門檻；
  // 淨係要有足夠碎屑就買得（admin 無限碎屑照免費）。
  const unlockedRow = await ensureShopUnlockFlag(admin, userId, catRow, mirror);

  const owned = unlockedRow.owned_skins || [DEFAULT_SKIN_ID];
  if (owned.includes(skinId)) {
    return { ok: false, error: '已經擁有呢隻貓。', already_owned: true };
  }

  const price = getCatPrice(mirror?.mirror_type, skinId);
  if (!unlimitedShards && (unlockedRow.moon_shards ?? 0) < price) {
    return { ok: false, error: '月光碎屑唔夠。', insufficient_shards: true };
  }

  const { error: economyError } = await admin
    .from('cat_economy_events')
    .insert({
      user_id: userId,
      action_type: 'shop_buy_cat',
      source_id: skinId,
      shards_delta: -price,
    });
  if (economyError) {
    if (economyError.code === '23505') {
      return { ok: false, error: '已經擁有呢隻貓。', already_owned: true };
    }
    throw economyError;
  }

  const cfg = CAT_SKIN_CONFIG[skinId];
  const nextShards = Math.max(0, (unlockedRow.moon_shards ?? 0) - price);
  const updatePayload = {
    owned_skins: [...owned, skinId],
    skin_id: skinId,
    meow_sound_id: cfg.meowId,
    moon_shards: nextShards,
  };

  const { data: updated, error: updateError } = await admin
    .from('user_cats')
    .update(updatePayload)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (updateError) throw updateError;

  const petsToday = await countPetsToday(admin, userId);
  const moonProfile = await fetchMoonProfileRow(admin, userId);
  const moonJourney = buildMoonJourneySummary(moonProfile);

  return {
    ok: true,
    shards_spent: price,
    cat: buildCatView(updated, { moonJourney, mirror, petsToday, unlimitedShards }),
    shop: buildShopView(updated, mirror, unlimitedShards),
  };
}

/**
 * 切換已擁有皮膚（§7.1）。
 */
export async function performCatEquip(admin, userId, skinId) {
  if (!CAT_SKIN_CONFIG[skinId]) {
    return { ok: false, error: '唔認得呢隻貓。' };
  }

  const catRow = await ensureUserCat(admin, userId);
  const owned = catRow.owned_skins || [DEFAULT_SKIN_ID];
  if (!owned.includes(skinId)) {
    return { ok: false, error: '未擁有呢隻貓，要去商店買先。' };
  }

  const cfg = CAT_SKIN_CONFIG[skinId];
  const { data: updated, error } = await admin
    .from('user_cats')
    .update({ skin_id: skinId, meow_sound_id: cfg.meowId })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;

  const [moonProfile, mirror, petsToday, unlimitedShards] = await Promise.all([
    fetchMoonProfileRow(admin, userId),
    fetchMirrorTypes(admin, userId),
    countPetsToday(admin, userId),
    isUnlimitedShardsUser(admin, userId),
  ]);
  const moonJourney = buildMoonJourneySummary(moonProfile);

  return {
    ok: true,
    cat: buildCatView(updated, { moonJourney, mirror, petsToday, unlimitedShards }),
    shop: buildShopView(updated, mirror, unlimitedShards),
  };
}

/** Cat + room payload for room shop responses (shard balance lives on user_cats). */
async function buildRoomShopResult(admin, userId, catRow, roomRow, extra = {}) {
  const [moonProfile, mirror, petsToday, unlimitedShards] = await Promise.all([
    fetchMoonProfileRow(admin, userId),
    fetchMirrorTypes(admin, userId),
    countPetsToday(admin, userId),
    isUnlimitedShardsUser(admin, userId),
  ]);
  const moonJourney = buildMoonJourneySummary(moonProfile);
  return {
    cat: buildCatView(catRow, { moonJourney, mirror, petsToday, unlimitedShards }),
    shop: buildShopView(catRow, mirror, unlimitedShards),
    room: buildRoomView(roomRow),
    ...extra,
  };
}

/**
 * 買家具（§12.5 碎屑商店）：扣 user_cats.moon_shards，加入 owned_items，
 * 並即時裝備到對應 slot。ledger action_type='shop_buy_room' 做冪等。
 */
export async function performRoomBuy(admin, userId, itemId) {
  const item = getRoomItem(itemId);
  if (!item) return { ok: false, error: '唔認得呢件家具。' };
  if (item.shardCost <= 0) return { ok: false, error: '呢件係預設家具，唔使買。' };

  let [catRow, roomRow] = await Promise.all([
    ensureUserCat(admin, userId).then((row) => ensureAdminTestShards(admin, userId, row)),
    ensureUserCatRoom(admin, userId),
  ]);

  // 房間表未 migrate → 唔好扣碎屑，直接提示。
  if (isFallbackRoom(roomRow)) {
    return { ok: false, error: '房間功能仲未開通，請稍後再試。', needs_migration: true };
  }

  const owned = roomRow.owned_items?.length ? roomRow.owned_items : [...DEFAULT_ROOM_OWNED];
  if (owned.includes(itemId)) {
    return { ok: false, error: '已經擁有呢件家具。', already_owned: true };
  }

  const unlimitedShards = await isUnlimitedShardsUser(admin, userId);
  if (!unlimitedShards && (catRow.moon_shards ?? 0) < item.shardCost) {
    return { ok: false, error: '月光碎屑唔夠。', insufficient_shards: true };
  }

  const { error: economyError } = await admin
    .from('cat_economy_events')
    .insert({
      user_id: userId,
      action_type: 'shop_buy_room',
      source_id: itemId,
      shards_delta: -item.shardCost,
    });
  if (economyError) {
    if (economyError.code === '23505') {
      return { ok: false, error: '已經擁有呢件家具。', already_owned: true };
    }
    throw economyError;
  }

  const { data: updatedCat, error: catErr } = await admin
    .from('user_cats')
    .update({ moon_shards: Math.max(0, (catRow.moon_shards ?? 0) - item.shardCost) })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (catErr) throw catErr;
  catRow = updatedCat;

  const nextEquipped = {
    ...DEFAULT_ROOM_EQUIPPED,
    ...(roomRow.equipped || {}),
    [item.slot]: itemId,
  };
  const updatedRoom = await upsertUserCatRoom(admin, userId, {
    owned_items: [...owned, itemId],
    equipped: nextEquipped,
  });

  return buildRoomShopResult(admin, userId, catRow, updatedRoom, {
    ok: true,
    shards_spent: item.shardCost,
  });
}

/** 切換已擁有家具（每 slot 一件）。 */
export async function performRoomEquip(admin, userId, itemId) {
  const item = getRoomItem(itemId);
  if (!item) return { ok: false, error: '唔認得呢件家具。' };

  const roomRow = await ensureUserCatRoom(admin, userId);
  if (isFallbackRoom(roomRow)) {
    return { ok: false, error: '房間功能仲未開通，請稍後再試。', needs_migration: true };
  }

  const owned = roomRow.owned_items?.length ? roomRow.owned_items : [...DEFAULT_ROOM_OWNED];
  if (!owned.includes(itemId)) {
    return { ok: false, error: '未擁有呢件家具，要去商店換先。' };
  }

  const nextEquipped = {
    ...DEFAULT_ROOM_EQUIPPED,
    ...(roomRow.equipped || {}),
    [item.slot]: itemId,
  };
  const updatedRoom = await upsertUserCatRoom(admin, userId, {
    equipped: nextEquipped,
    owned_items: owned,
  });
  const catRow = await ensureUserCat(admin, userId);

  return buildRoomShopResult(admin, userId, catRow, updatedRoom, { ok: true });
}
