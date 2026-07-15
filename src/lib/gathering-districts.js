/**
 * Hong Kong 18 districts + online — public location for Moonlight Gatherings.
 */

/** Official 18 districts (Traditional Chinese). */
export const HK_DISTRICTS = [
  // 香港島
  '中西區',
  '灣仔區',
  '東區',
  '南區',
  // 九龍
  '油尖旺區',
  '深水埗區',
  '九龍城區',
  '黃大仙區',
  '觀塘區',
  // 新界
  '荃灣區',
  '屯門區',
  '元朗區',
  '北區',
  '大埔區',
  '沙田區',
  '西貢區',
  '葵青區',
  '離島區',
];

export const GATHERING_LOCATION_ONLINE = '線上';

export const GATHERING_PUBLIC_LOCATIONS = [...HK_DISTRICTS, GATHERING_LOCATION_ONLINE];

const LOCATION_SET = new Set(GATHERING_PUBLIC_LOCATIONS);

export function isValidGatheringPublicLocation(value) {
  return LOCATION_SET.has(String(value || '').trim());
}

export function normalizeGatheringPublicLocation(raw) {
  const s = String(raw || '').trim();
  return LOCATION_SET.has(s) ? s : null;
}
