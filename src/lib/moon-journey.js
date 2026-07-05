/**
 * Moon Journey (月光旅程) — forum EXP, levels, check-in.
 */

export const MOON_JOURNEY_GUIDE_PATH = '/moon-journey';

export const MOON_JOURNEY_EXP = {
  post_created: 15,
  comment_created: 5,
  comment_liked: 3,
  post_bookmarked: 10,
  daily_checkin: 2,
};

export const MOON_JOURNEY_COMMENT_DAILY_LIMIT = 10;

/** User-facing copy for check-in streak rules (guide page + docs). */
export const MOON_JOURNEY_CHECKIN_STREAK_RULES = [
  {
    title: '每日打卡獎勵',
    body: '每個香港日曆日可打卡一次，固定獲得 +2 EXP。',
  },
  {
    title: '連續天數怎樣計',
    body: '若昨日（香港時區）已打卡，今日打卡後連續天數 +1；若中斷一日，下次打卡會從 1 重新計算。',
  },
  {
    title: '在哪裡看到',
    body: '連續打卡天數會顯示於黑貓樹洞月光旅程面板與帳戶頁。',
  },
  {
    title: '與 EXP 的關係',
    body: '每次打卡的 EXP 固定為 +2；連續天數是參與紀錄與成就展示，不會令單次打卡額外加倍。',
  },
];

export const MOON_JOURNEY_LEVELS = [
  { level: 1, minExp: 0, emoji: '🌑', titleZh: '月下幼貓', titleEn: 'Moon Kitten' },
  { level: 2, minExp: 40, emoji: '🌒', titleZh: '夜行者', titleEn: 'Night Wanderer' },
  { level: 3, minExp: 120, emoji: '🌓', titleZh: '月光傾聽者', titleEn: 'Moon Listener' },
  { level: 4, minExp: 250, emoji: '🌔', titleZh: '月光同行者', titleEn: 'Moon Companion' },
  { level: 5, minExp: 450, emoji: '🌕', titleZh: '月光守護者', titleEn: 'Moon Guardian' },
  { level: 6, minExp: 700, emoji: '🌟', titleZh: '星光守護者', titleEn: 'Star Keeper' },
  { level: 7, minExp: 1000, emoji: '🌌', titleZh: '月夜賢者', titleEn: 'Moon Sage' },
];

const HK_TZ = 'Asia/Hong_Kong';

export function getHongKongDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HK_TZ }).format(date);
}

export function getYesterdayHongKongDateString(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return getHongKongDateString(d);
}

export function getLevelFromExp(exp) {
  const safeExp = Math.max(0, Number(exp) || 0);
  let current = MOON_JOURNEY_LEVELS[0];
  for (const row of MOON_JOURNEY_LEVELS) {
    if (safeExp >= row.minExp) current = row;
  }
  const idx = MOON_JOURNEY_LEVELS.findIndex((r) => r.level === current.level);
  const next = MOON_JOURNEY_LEVELS[idx + 1] || null;
  const progressMin = current.minExp;
  const progressMax = next ? next.minExp : current.minExp;
  const span = progressMax - progressMin;
  const progressPct = next && span > 0
    ? Math.min(100, Math.round(((safeExp - progressMin) / span) * 100))
    : 100;

  return {
    level: current.level,
    emoji: current.emoji,
    title_zh: current.titleZh,
    title_en: current.titleEn,
    exp: safeExp,
    exp_to_next: next ? Math.max(0, next.minExp - safeExp) : 0,
    next_level: next?.level ?? null,
    next_title_zh: next?.titleZh ?? null,
    next_title_en: next?.titleEn ?? null,
    progress_pct: progressPct,
    is_max_level: !next,
  };
}

export function buildMoonJourneySummary(profileRow) {
  const exp = profileRow?.moon_journey_exp ?? 0;
  const levelInfo = getLevelFromExp(exp);
  const todayHk = getHongKongDateString();
  const lastCheckin = profileRow?.moon_last_checkin_date || null;

  return {
    ...levelInfo,
    checkin_streak: profileRow?.moon_checkin_streak ?? 0,
    checked_in_today: lastCheckin === todayHk,
    last_checkin_date: lastCheckin,
  };
}

async function fetchMoonProfile(admin, userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('moon_journey_exp, moon_journey_level, moon_checkin_streak, moon_last_checkin_date')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || {
    moon_journey_exp: 0,
    moon_journey_level: 1,
    moon_checkin_streak: 0,
    moon_last_checkin_date: null,
  };
}

async function incrementCommentDailyCount(admin, userId, actionDate) {
  const { data: existing } = await admin
    .from('moon_journey_daily_counts')
    .select('comment_exp_count')
    .eq('user_id', userId)
    .eq('action_date', actionDate)
    .maybeSingle();

  if (existing) {
    if (existing.comment_exp_count >= MOON_JOURNEY_COMMENT_DAILY_LIMIT) {
      return false;
    }
    const { error } = await admin
      .from('moon_journey_daily_counts')
      .update({ comment_exp_count: existing.comment_exp_count + 1 })
      .eq('user_id', userId)
      .eq('action_date', actionDate);
    if (error) throw error;
    return true;
  }

  const { error } = await admin
    .from('moon_journey_daily_counts')
    .insert({
      user_id: userId,
      action_date: actionDate,
      comment_exp_count: 1,
    });
  if (error) throw error;
  return true;
}

/**
 * Award EXP idempotently via ledger. Returns { awarded, ... }.
 */
export async function awardMoonJourneyExp(admin, {
  userId,
  actionType,
  sourceId,
  amount,
  skipDailyCommentLimit = false,
}) {
  if (!userId || !actionType || !sourceId || !amount || amount <= 0) {
    return { awarded: false, reason: 'invalid' };
  }

  if (actionType === 'comment_created' && !skipDailyCommentLimit) {
    const todayHk = getHongKongDateString();
    const allowed = await incrementCommentDailyCount(admin, userId, todayHk);
    if (!allowed) return { awarded: false, reason: 'daily_comment_limit' };
  }

  const { error: insertError } = await admin
    .from('moon_journey_events')
    .insert({
      user_id: userId,
      action_type: actionType,
      source_id: String(sourceId),
      exp_amount: amount,
    });

  if (insertError) {
    if (insertError.code === '23505') return { awarded: false, reason: 'duplicate' };
    throw insertError;
  }

  const profile = await fetchMoonProfile(admin, userId);
  const prevLevel = profile.moon_journey_level ?? 1;
  const nextExp = (profile.moon_journey_exp ?? 0) + amount;
  const levelInfo = getLevelFromExp(nextExp);

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      moon_journey_exp: nextExp,
      moon_journey_level: levelInfo.level,
    })
    .eq('id', userId);

  if (updateError) throw updateError;

  return {
    awarded: true,
    exp_gained: amount,
    exp_total: nextExp,
    level: levelInfo.level,
    leveled_up: levelInfo.level > prevLevel,
    level_info: levelInfo,
  };
}

export async function performDailyCheckIn(admin, userId) {
  const profile = await fetchMoonProfile(admin, userId);
  const todayHk = getHongKongDateString();
  const yesterdayHk = getYesterdayHongKongDateString();

  if (profile.moon_last_checkin_date === todayHk) {
    const summary = buildMoonJourneySummary(profile);
    return {
      awarded: false,
      already_checked_in: true,
      moon_journey: summary,
      ...summary,
    };
  }

  const nextStreak = profile.moon_last_checkin_date === yesterdayHk
    ? (profile.moon_checkin_streak ?? 0) + 1
    : 1;

  const award = await awardMoonJourneyExp(admin, {
    userId,
    actionType: 'daily_checkin',
    sourceId: todayHk,
    amount: MOON_JOURNEY_EXP.daily_checkin,
    skipDailyCommentLimit: true,
  });

  if (!award.awarded && award.reason === 'duplicate') {
    await admin
      .from('profiles')
      .update({
        moon_last_checkin_date: todayHk,
        moon_checkin_streak: nextStreak,
      })
      .eq('id', userId);
    const refreshed = await fetchMoonProfile(admin, userId);
    const summary = buildMoonJourneySummary(refreshed);
    return {
      awarded: false,
      already_checked_in: true,
      moon_journey: summary,
      ...summary,
    };
  }

  if (!award.awarded) {
    const summary = buildMoonJourneySummary(profile);
    return { awarded: false, moon_journey: summary, ...summary };
  }

  await admin
    .from('profiles')
    .update({
      moon_last_checkin_date: todayHk,
      moon_checkin_streak: nextStreak,
    })
    .eq('id', userId);

  const refreshed = await fetchMoonProfile(admin, userId);
  const summary = buildMoonJourneySummary({
    ...refreshed,
    moon_checkin_streak: nextStreak,
    moon_last_checkin_date: todayHk,
  });

  return {
    ...award,
    already_checked_in: false,
    moon_journey: summary,
    ...summary,
  };
}

export async function getMoonJourneyForUser(admin, userId) {
  const profile = await fetchMoonProfile(admin, userId);
  return buildMoonJourneySummary(profile);
}

export const MOON_JOURNEY_EXP_RULES = [
  { label: '發帖', exp: MOON_JOURNEY_EXP.post_created, note: '受每日發文額度限制' },
  { label: '留言', exp: MOON_JOURNEY_EXP.comment_created, note: `每日最多 ${MOON_JOURNEY_COMMENT_DAILY_LIMIT} 次；不計自己帖` },
  { label: '留言被 Like', exp: MOON_JOURNEY_EXP.comment_liked, note: '每次唯一' },
  { label: '帖文被收藏', exp: MOON_JOURNEY_EXP.post_bookmarked, note: '每次唯一' },
  { label: '今日打卡', exp: MOON_JOURNEY_EXP.daily_checkin, note: '每日一次' },
];

export const MOON_JOURNEY_ACTION_LABELS = {
  post_created: '發帖',
  comment_created: '留言',
  comment_liked: '留言被 Like',
  post_bookmarked: '帖文被收藏',
  daily_checkin: '打卡',
};
