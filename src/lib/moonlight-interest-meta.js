/**
 * Shared labels / option maps for Moonlight Gathering #001 participation form.
 */

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
