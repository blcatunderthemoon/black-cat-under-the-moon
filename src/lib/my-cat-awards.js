/**
 * awardCatCare — 共用發獎 helper（docs/my-cat/MY-CAT-SOUL-AND-SHARDS.md §5.2）。
 * SERVER ONLY. 冪等：ledger UNIQUE(user_id, action_type, source_id) 防重複發放。
 * 靈魂寫 cat_care_events；碎屑寫 cat_economy_events；成功先更新 user_cats。
 */

import { clampStat, clampSoul } from './my-cat.js';
import { getHongKongDateString } from './moon-journey.js';

/** Mirror 首次儲存（§7.1）— 一次性，唔可以单靠佢跳過每日養成 */
export const MIRROR_FIRST_SOUL_GAIN = 8;
export const MIRROR_FIRST_SHARDS_GAIN = 20;
/** 論壇發帖碎屑（§3.2-C） */
export const FORUM_POST_SHARDS_GAIN = 2;
export const FORUM_POST_SHARDS_DAILY_LIMIT = 3;

/** 論壇發帖靈魂（v4：參與養成）+1／帖，每日上限 2。 */
export const FORUM_POST_SOUL_GAIN = 1;
export const FORUM_POST_SOUL_DAILY_LIMIT = 2;
/** 玩漂流瓶靈魂（投瓶／回覆）+1，每日上限 1。 */
export const BOTTLE_SOUL_GAIN = 1;
export const BOTTLE_SOUL_DAILY_LIMIT = 1;

/** 確保 user_cats row 存在（獨立實作，避免同 my-cat-server 循環 import）。 */
async function ensureCatRow(admin, userId) {
  const { data: existing } = await admin
    .from('user_cats')
    .select('soul, moon_shards')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await admin
    .from('user_cats')
    .insert({ user_id: userId })
    .select('soul, moon_shards')
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: raced } = await admin
        .from('user_cats')
        .select('soul, moon_shards')
        .eq('user_id', userId)
        .single();
      if (raced) return raced;
    }
    throw error;
  }
  return created;
}

/**
 * @returns {{ awarded: boolean, soul_gained: number, shards_gained: number }}
 */
export async function awardCatCare(admin, userId, {
  actionType,
  sourceId,
  deltaSoul = 0,
  shardsDelta = 0,
}) {
  let soulGained = 0;
  let shardsGained = 0;

  if (deltaSoul) {
    const { error } = await admin
      .from('cat_care_events')
      .insert({
        user_id: userId,
        action_type: actionType,
        source_id: sourceId,
        delta_soul: deltaSoul,
      });
    if (!error) soulGained = deltaSoul;
    else if (error.code !== '23505') throw error;
  }

  if (shardsDelta) {
    const { error } = await admin
      .from('cat_economy_events')
      .insert({
        user_id: userId,
        action_type: actionType,
        source_id: sourceId,
        shards_delta: shardsDelta,
      });
    if (!error) shardsGained = shardsDelta;
    else if (error.code !== '23505') throw error;
  }

  if (!soulGained && !shardsGained) {
    return { awarded: false, soul_gained: 0, shards_gained: 0 };
  }

  const row = await ensureCatRow(admin, userId);
  const updates = {};
  if (soulGained) updates.soul = clampSoul((row.soul ?? 0) + soulGained);
  if (shardsGained) updates.moon_shards = Math.max(0, (row.moon_shards ?? 0) + shardsGained);
  const { error: updateError } = await admin
    .from('user_cats')
    .update(updates)
    .eq('user_id', userId);
  if (updateError) throw updateError;

  return { awarded: true, soul_gained: soulGained, shards_gained: shardsGained };
}

/** 連續打卡碎屑里程碑（每個里程碑一次過，唔會因斷 streak 重發） */
export const STREAK_SHARD_MILESTONES = { 3: 2, 7: 5, 14: 10 };
/** 連續打卡靈魂小里程碑（餵食時結算） */
export const STREAK_SOUL_MILESTONES = { 7: 1, 14: 2 };
/** 連續打卡 30 日 → 靈魂 +3（一次性） */
export const STREAK_SOUL_MILESTONE = { days: 30, soul: 3 };
/** Moon Journey 每升一級 → 靈魂 +2 */
export const LEVEL_UP_SOUL_GAIN = 2;

/**
 * 餵食（打卡）後結算 streak／升級獎勵。
 * @returns {{ shards: number, soul: number }} 今次實發嘅額外獎勵
 */
export async function applyFeedMilestones(admin, userId, { streak = 0, leveledUp = false, level = 1 } = {}) {
  let bonusShards = 0;
  let bonusSoul = 0;

  const shardReward = STREAK_SHARD_MILESTONES[streak];
  if (shardReward) {
    const r = await awardCatCare(admin, userId, {
      actionType: 'streak_milestone',
      sourceId: `streak:${streak}`,
      shardsDelta: shardReward,
    });
    bonusShards += r.shards_gained;
  }

  const streakSoulReward = STREAK_SOUL_MILESTONES[streak];
  if (streakSoulReward) {
    const r = await awardCatCare(admin, userId, {
      actionType: 'streak_soul',
      sourceId: `streak:${streak}`,
      deltaSoul: streakSoulReward,
    });
    bonusSoul += r.soul_gained;
  }

  if (streak === STREAK_SOUL_MILESTONE.days) {
    const r = await awardCatCare(admin, userId, {
      actionType: 'streak_milestone',
      sourceId: `streak:${streak}`,
      deltaSoul: STREAK_SOUL_MILESTONE.soul,
    });
    bonusSoul += r.soul_gained;
  }

  if (leveledUp && level > 1) {
    const r = await awardCatCare(admin, userId, {
      actionType: 'level_up',
      sourceId: `level:${level}`,
      deltaSoul: LEVEL_UP_SOUL_GAIN,
    });
    bonusSoul += r.soul_gained;
  }

  return { shards: bonusShards, soul: bonusSoul };
}

/** Mirror Card 首次建立 → 靈魂 +30、碎屑 +20（各寫入對應 ledger）。 */
export async function awardMirrorFirstSave(admin, userId, cardId) {
  return awardCatCare(admin, userId, {
    actionType: 'mirror_card_saved',
    sourceId: String(cardId),
    deltaSoul: MIRROR_FIRST_SOUL_GAIN,
    shardsDelta: MIRROR_FIRST_SHARDS_GAIN,
  });
}

/** 論壇發帖碎屑 +2，每日最多 3 帖；`source_id` = post.id 防重複。 */
export async function awardForumPostShards(admin, userId, postId) {
  const todayHk = getHongKongDateString();
  const dayStart = `${todayHk}T00:00:00+08:00`;

  const { count } = await admin
    .from('cat_economy_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', 'forum_post')
    .gte('created_at', dayStart);

  if ((count ?? 0) >= FORUM_POST_SHARDS_DAILY_LIMIT) {
    return { awarded: false, soul_gained: 0, shards_gained: 0 };
  }

  return awardCatCare(admin, userId, {
    actionType: 'forum_post',
    sourceId: String(postId),
    shardsDelta: FORUM_POST_SHARDS_GAIN,
  });
}

/** 今日某 soul action 已發放次數（HK 曆日）。 */
async function countCareToday(admin, userId, actionType) {
  const dayStart = `${getHongKongDateString()}T00:00:00+08:00`;
  const { count } = await admin
    .from('cat_care_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .gte('created_at', dayStart);
  return count ?? 0;
}

/**
 * 論壇發帖靈魂 +1（每日上限 2）；`source_id` = post.id 防同帖重複。
 * 靈魂只由參與得來，係成長主力（v4）。
 */
export async function awardForumPostSoul(admin, userId, postId) {
  const used = await countCareToday(admin, userId, 'forum_soul');
  if (used >= FORUM_POST_SOUL_DAILY_LIMIT) {
    return { awarded: false, soul_gained: 0, shards_gained: 0 };
  }
  return awardCatCare(admin, userId, {
    actionType: 'forum_soul',
    sourceId: String(postId),
    deltaSoul: FORUM_POST_SOUL_GAIN,
  });
}

/**
 * 玩漂流瓶靈魂 +1（投瓶／回覆，每日上限 2）。
 * 隱私：唔會將身份寫入瓶身，只喺私有 ledger 靜默記帳（§7.2 漂流瓶側錄）。
 * `source_id` 用「日期#序號」，每日封頂而唔綁定具體瓶子，保持匿名。
 */
export async function awardBottleSoul(admin, userId) {
  const used = await countCareToday(admin, userId, 'bottle_play');
  if (used >= BOTTLE_SOUL_DAILY_LIMIT) {
    return { awarded: false, soul_gained: 0, shards_gained: 0 };
  }
  return awardCatCare(admin, userId, {
    actionType: 'bottle_play',
    sourceId: `${getHongKongDateString()}#${used + 1}`,
    deltaSoul: BOTTLE_SOUL_GAIN,
  });
}

/** 月光心願 — 完成獎 +3；首次公開設立 +1；打氣里程碑。 */
export const WISH_COMPLETE_SHARDS = 3;
export const WISH_FIRST_CREATE_SHARDS = 1;
export const WISH_CHEER_MILESTONE_SHARDS = { 10: 1, 30: 2 };

/**
 * 完成心願 +3 碎屑。每個心願冪等發放一次（source_id = wishId）。
 * @returns {{ awarded: boolean, soul_gained: number, shards_gained: number, reason?: string }}
 */
export async function awardWishCompleteShards(admin, userId, wishId) {
  const result = await awardCatCare(admin, userId, {
    actionType: 'wish_complete',
    sourceId: String(wishId),
    shardsDelta: WISH_COMPLETE_SHARDS,
  });
  return { ...result, reason: result.awarded ? undefined : 'already_awarded' };
}

/** 首次設立公開心願 +1（終身一次；source_id = first）。 */
export async function awardWishFirstCreateShards(admin, userId) {
  return awardCatCare(admin, userId, {
    actionType: 'wish_first_create',
    sourceId: 'first',
    shardsDelta: WISH_FIRST_CREATE_SHARDS,
  });
}

/** 是否已領過「首次公開設立」+1 碎屑。 */
export async function hasClaimedWishFirstCreate(admin, userId) {
  const { data } = await admin
    .from('cat_economy_events')
    .select('id')
    .eq('user_id', userId)
    .eq('action_type', 'wish_first_create')
    .eq('source_id', 'first')
    .maybeSingle();
  return Boolean(data);
}

/**
 * 收到打氣里程碑（10／30）發碎屑給許下心願嘅人。
 * source_id = `${wishId}#cheers_${n}`
 */
export async function awardWishCheerMilestone(admin, userId, wishId, cheerCount) {
  const milestones = Object.keys(WISH_CHEER_MILESTONE_SHARDS)
    .map(Number)
    .sort((a, b) => a - b);
  let total = { awarded: false, soul_gained: 0, shards_gained: 0 };
  for (const n of milestones) {
    if (cheerCount < n) continue;
    const shards = WISH_CHEER_MILESTONE_SHARDS[n];
    const result = await awardCatCare(admin, userId, {
      actionType: 'wish_cheer_milestone',
      sourceId: `${wishId}#cheers_${n}`,
      shardsDelta: shards,
    });
    if (result.awarded) {
      total = {
        awarded: true,
        soul_gained: total.soul_gained + result.soul_gained,
        shards_gained: total.shards_gained + result.shards_gained,
      };
    }
  }
  return total;
}
