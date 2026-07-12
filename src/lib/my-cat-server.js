/**
 * My Cat — server operations (admin client passed in, same pattern as moon-journey.js).
 * SERVER ONLY: import from API routes.
 * Spec: docs/MY-CAT-GAME-DESIGN.md §4, §5, §10
 */

import {
  DEFAULT_SKIN_ID,
  CAT_SKIN_CONFIG,
  FEED_HUNGER_GAIN,
  FEED_SHARDS_GAIN,
  PET_AFFECTION_GAIN,
  PET_DAILY_LIMIT,
  petCooldownMs,
  nextPetAvailableIso,
  applyStatDecay,
  clampStat,
  getGrowthStage,
  getCatMeowUrl,
} from './my-cat.js';
import { pickCatLine } from './my-cat-lines.js';
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
 * Build the client-facing cat payload.
 * Decay is computed lazily from stored values + elapsed days; stored stats
 * only change on feed/pet, so this stays idempotent.
 */
function buildCatView(catRow, { moonJourney, mirror, petsToday }) {
  const skinId = catRow.skin_id || DEFAULT_SKIN_ID;
  const todayHk = getHongKongDateString();

  const decayed = applyStatDecay({
    hunger: catRow.hunger,
    affection: catRow.affection,
    daysSinceFed: hkDaysSince(catRow.last_fed_date || catRow.created_at),
    daysSincePet: hkDaysSince(catRow.last_pet_at || catRow.created_at),
  });

  const growthStage = getGrowthStage({
    soul: catRow.soul,
    moonLevel: moonJourney?.level ?? 1,
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
    hunger: clampStat(decayed.hunger),
    affection: clampStat(decayed.affection),
    soul: clampStat(catRow.soul),
    growth_stage: growthStage,
    moon_shards: catRow.moon_shards ?? 0,
    owned_skins: catRow.owned_skins || [DEFAULT_SKIN_ID],
    cat_shop_unlocked: !!catRow.cat_shop_unlocked,
    fed_today: catRow.last_fed_date === todayHk,
    pets_today: petsToday ?? 0,
    pet_daily_limit: PET_DAILY_LIMIT,
    next_pet_available_at: nextPetAvailableIso(
      catRow.last_pet_at ? new Date(catRow.last_pet_at).getTime() : 0,
      petsToday ?? 0,
    ),
  };
}

/** Full state for GET /api/my-cat. */
export async function getMyCatState(admin, userId) {
  const [catRow, moonProfile, mirror] = await Promise.all([
    ensureUserCat(admin, userId),
    fetchMoonProfileRow(admin, userId),
    fetchMirrorTypes(admin, userId),
  ]);
  const petsToday = await countPetsToday(admin, userId);
  const moonJourney = buildMoonJourneySummary(moonProfile);

  return {
    cat: buildCatView(catRow, { moonJourney, mirror, petsToday }),
    moon_journey: moonJourney,
  };
}

/**
 * Feed = unified daily ritual (§5.2):
 * one HK calendar day → Moon Journey check-in (+2 EXP) + hunger +25 + shards +3.
 * Idempotent per day via last_fed_date + ledgers.
 */
export async function performCatFeed(admin, userId) {
  const todayHk = getHongKongDateString();
  const catRow = await ensureUserCat(admin, userId);

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
      cat: buildCatView(catRow, { moonJourney: checkin.moon_journey, mirror, petsToday }),
    };
  }

  // Care ledger — the 23505 path means a concurrent feed won.
  const { error: careError } = await admin
    .from('cat_care_events')
    .insert({
      user_id: userId,
      action_type: 'daily_feed',
      source_id: todayHk,
      delta_hunger: FEED_HUNGER_GAIN,
    });
  if (careError && careError.code !== '23505') throw careError;
  const firstFeed = !careError;

  let shardsGained = 0;
  let nextRow = catRow;

  if (firstFeed) {
    const decayed = applyStatDecay({
      hunger: catRow.hunger,
      affection: catRow.affection,
      daysSinceFed: hkDaysSince(catRow.last_fed_date || catRow.created_at),
      daysSincePet: 0,
    });
    const newHunger = clampStat(decayed.hunger + FEED_HUNGER_GAIN);

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
        hunger: newHunger,
        last_fed_date: todayHk,
        moon_shards: (catRow.moon_shards ?? 0) + shardsGained,
      })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    nextRow = updated;
  }

  const mirror = await fetchMirrorTypes(admin, userId);
  const petsToday = await countPetsToday(admin, userId);

  return {
    already_fed_today: !firstFeed,
    awarded: !!checkin.awarded,
    exp_gained: checkin.awarded ? checkin.exp_gained : 0,
    leveled_up: !!checkin.leveled_up,
    shards_gained: shardsGained,
    moon_journey: checkin.moon_journey,
    cat: buildCatView(nextRow, { moonJourney: checkin.moon_journey, mirror, petsToday }),
  };
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

  const [moonProfile, mirror, petsToday] = await Promise.all([
    fetchMoonProfileRow(admin, userId),
    fetchMirrorTypes(admin, userId),
    countPetsToday(admin, userId),
  ]);
  const moonJourney = buildMoonJourneySummary(moonProfile);

  return {
    ok: true,
    cat: buildCatView(updated, { moonJourney, mirror, petsToday }),
  };
}

/**
 * Tap to Meow (§4.1): up to PET_DAILY_LIMIT taps per HK day, each +2 affection,
 * gated by an escalating cooldown (0 / 3 / 15 / 30 / 60 min between taps).
 * last_pet_at only advances on a counted tap, so blocked taps don't extend the wait.
 */
export async function performCatPet(admin, userId, { lastLine = null } = {}) {
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
      cat: buildCatView(row, { moonJourney, mirror, petsToday }),
      ...extra,
    };
  };

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

  const decayed = applyStatDecay({
    hunger: catRow.hunger,
    affection: catRow.affection,
    daysSinceFed: 0,
    daysSincePet: hkDaysSince(catRow.last_pet_at || catRow.created_at),
  });
  const newAffection = clampStat(decayed.affection + (counted ? PET_AFFECTION_GAIN : 0));

  const updatePayload = counted
    ? { affection: newAffection, last_pet_at: new Date(now).toISOString() }
    : { affection: newAffection };

  const { data: updated, error: updateError } = await admin
    .from('user_cats')
    .update(updatePayload)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (updateError) throw updateError;

  return buildResult(updated, { counted });
}
