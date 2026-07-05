/**
 * Display name length + reserved-word policy (signup, profile update, profile creation).
 *
 * Reserved terms block impersonation of staff, official accounts, and the platform brand.
 * General profanity / crisis language is handled separately by content-filter.js.
 */

import { filterContent } from './content-filter.js';

export const DISPLAY_NAME_MAX_LENGTH = 20;

/** Platform / product names users must not pose as */
const RESERVED_BRAND_TERMS = [
  'blackcatunderthemoon',
  'blackcatunderthemoonhk',
  'blackcatmoon',
  'underthemoon',
  'blackcatofficial',
  'moonofficial',
  '黑貓樹洞',
  '黑貓官方',
  '月下官方',
  '月下黑貓',
  '月光官方',
];

/** Staff, moderation, and support roles */
const RESERVED_ROLE_TERMS = [
  'admin',
  'administrator',
  'superadmin',
  'sysadmin',
  'moderator',
  'modteam',
  'staff',
  'official',
  'system',
  'root',
  'support',
  'operator',
  'webmaster',
  'helpdesk',
  'customerservice',
  'securityteam',
  'verifiedaccount',
  '管理員',
  '管理员',
  '版主',
  '官方',
  '系統',
  '系统',
  '客服',
  '營運',
  '营运',
  '小編',
  '小编',
  '站長',
  '站长',
  '維運',
  '维运',
  '營運團隊',
  '营运团队',
  '管理團隊',
  '管理团队',
  '審核員',
  '审核员',
  '巡查員',
  '巡查员',
  '技術支援',
  '技术支援',
  '官方帳號',
  '官方账号',
  '官方帳戶',
  '官方账户',
  '平台管理',
  '平台官方',
  '帳號安全',
  '账号安全',
  '安全中心',
  '驗證中心',
  '验证中心',
  '黑貓管理',
];

/** Fake system / anonymous-official handles */
const RESERVED_SYSTEM_TERMS = [
  'systemnotify',
  'systemmessage',
  'officialnotice',
  '匿名官方',
  '系統通知',
  '系统通知',
];

const RESERVED_DISPLAY_NAME_TERMS = [
  ...RESERVED_BRAND_TERMS,
  ...RESERVED_ROLE_TERMS,
  ...RESERVED_SYSTEM_TERMS,
];

function normalizeForReservedCheck(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
    .replace(/[@]/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/[\s._\-·]+/g, '');
}

function containsReservedTerm(normalized) {
  for (const term of RESERVED_DISPLAY_NAME_TERMS) {
    if (normalized.includes(normalizeForReservedCheck(term))) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} name
 * @param {{ previousName?: string }} [options]
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateDisplayName(name, options = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return { ok: false, error: '請填寫你的暱稱。' };
  }
  const previousName = String(options.previousName || '').trim();
  if (previousName && trimmed === previousName) {
    return { ok: true, value: trimmed };
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, error: `暱稱最多 ${DISPLAY_NAME_MAX_LENGTH} 字。` };
  }
  if (containsReservedTerm(normalizeForReservedCheck(trimmed))) {
    return { ok: false, error: '此暱稱無法使用，請換一個名字。' };
  }
  const { blocked } = filterContent(trimmed);
  if (blocked) {
    return { ok: false, error: '暱稱包含不允許的詞語。' };
  }
  return { ok: true, value: trimmed };
}

/** Pick a safe stored display name, falling back when metadata is invalid. */
export function resolveSafeDisplayName(rawName, email) {
  const validation = validateDisplayName(rawName);
  if (validation.ok) return validation.value;

  const emailPrefix = String(email || '').split('@')[0]?.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  if (emailPrefix && validateDisplayName(emailPrefix).ok) return emailPrefix;

  return '貓咪';
}
