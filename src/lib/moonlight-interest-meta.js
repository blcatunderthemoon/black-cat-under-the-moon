/**
 * Shared labels / option maps for Moonlight Gathering #001 participation form.
 */

/** #001 only accepts Pure / Bi applicants. */
export const MOONLIGHT_ELIGIBLE_IDENTITIES = ['Pure', 'Bi'];

export function isMoonlightEligibleIdentity(value) {
  return MOONLIGHT_ELIGIBLE_IDENTITIES.includes(String(value || '').trim());
}

export const INTEREST_LABELS = {
  interested: '有興趣',
  unsure: '未能確定',
  skip: '今次唔參加',
};

export const TIME_SLOT_LABELS = {
  sat_afternoon: '星期六下午',
  sat_eve: '星期六晚上',
  sun_afternoon: '星期日下午',
  sun_eve: '星期日晚上',
};

export const PRICE_LABELS = {
  '250-300': '$250–300',
  '300-350': '$300–350',
  '350-400': '$350–400',
};

/** Profile questions on the #001 participation form (stored in answers jsonb). */
export const PROFILE_QUESTIONS = [
  {
    key: 'hobbies',
    label: '你有咩個人興趣？',
    placeholder: '例如：貓、Board Game、攝影…',
  },
  {
    key: 'pets',
    label: '有冇養寵物？（有嘅話係咩？）',
    placeholder: '例如：冇／有一隻黑貓叫…',
  },
  {
    key: 'singer',
    label: '最鍾意邊位歌手？',
    placeholder: '可以寫多過一位',
  },
  {
    key: 'movie',
    label: '最鍾意嘅電影？',
    placeholder: '電影名或類型都得',
  },
  {
    key: 'travel',
    label: '最想去邊個國家旅行？',
    placeholder: '例如：日本、冰島…',
  },
  {
    key: 'sports',
    label: '有冇做運動？最鍾意咩運動？',
    placeholder: '例如：少做／最鍾意行山、瑜伽…',
  },
];

export const PROFILE_QUESTION_KEYS = PROFILE_QUESTIONS.map((q) => q.key);

/** Labels for active + legacy survey dates (legacy kept for dashboard display). */
export const DATE_LABELS = {
  '2026-08-15': '8/15（六）',
  '2026-08-16': '8/16（日）',
  '2026-08-22': '8/22（六）',
  '2026-08-23': '8/23（日）',
  '2026-08-29': '8/29（六）',
  '2026-08-30': '8/30（日）',
  '2026-09-05': '9/5（六）',
  '2026-09-06': '9/6（日）',
  '2026-09-12': '9/12（六）',
  '2026-09-13': '9/13（日）',
  '2026-09-19': '9/19（六）',
  '2026-09-20': '9/20（日）',
  '2026-09-26': '9/26（六）',
  '2026-09-27': '9/27（日）',
};

/** Active #001 session date for charts. */
export const DATE_ORDER = [
  '2026-09-19',
];

export const TIME_SLOT_ORDER = Object.keys(TIME_SLOT_LABELS);

export function formatMoonlightDate(iso) {
  return DATE_LABELS[iso] || iso;
}

export function formatMoonlightTimeSlot(key) {
  return TIME_SLOT_LABELS[key] || key;
}

export function formatMoonlightInterest(key) {
  return INTEREST_LABELS[key] || key;
}

export function formatMoonlightPrice(key) {
  return PRICE_LABELS[key] || key || '—';
}

/** Compact multi-line summary for admin tables. */
export function formatMoonlightAnswers(answers) {
  if (!answers || typeof answers !== 'object') return '';
  const lines = [];
  const identity = typeof answers.identity === 'string' ? answers.identity.trim() : '';
  if (identity) lines.push(`Label ${identity}`);
  for (const q of PROFILE_QUESTIONS) {
    const v = typeof answers[q.key] === 'string' ? answers[q.key].trim() : '';
    if (!v) continue;
    lines.push(`${q.label} ${v}`);
  }
  return lines.join('\n');
}
