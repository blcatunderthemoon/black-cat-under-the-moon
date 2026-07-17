/**
 * Contact validation for Moonlight Gatherings (email + phone).
 */

export const GATHERING_EMAIL_MAX = 120;
export const GATHERING_PHONE_MAX = 20;

/** Basic email check — not full RFC, enough for form gate. */
export function normalizeGatheringEmail(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s.length < 5 || s.length > GATHERING_EMAIL_MAX) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(s)) return null;
  return s;
}

/**
 * Accept HK mobile/local or +852… ; keep digits and leading +.
 * @returns {string|null} normalised phone string
 */
export function normalizeGatheringPhone(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  s = s.replace(/[\s\-()]/g, '');
  if (!/^\+?[0-9]+$/u.test(s)) return null;
  if (s.length < 8 || s.length > GATHERING_PHONE_MAX) return null;
  // Prefer local 8-digit or intl with country code
  if (!s.startsWith('+') && !/^[0-9]{8,11}$/u.test(s)) return null;
  return s;
}

/**
 * Mask an email for at-a-glance display: keep first char + domain.
 * e.g. "luna@gmail.com" -> "l****@gmail.com"
 */
export function maskEmail(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const at = s.indexOf('@');
  if (at < 1) return '****';
  const first = s.slice(0, 1);
  const domain = s.slice(at);
  return `${first}****${domain}`;
}

/**
 * Mask a phone number: keep the last 4 digits.
 * e.g. "91234567" -> "****4567"
 */
export function maskPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.length <= 4) return '****';
  return `****${s.slice(-4)}`;
}

/**
 * @param {object} body
 * @param {{ emailKey?: string, phoneKey?: string, phoneRequired?: boolean }} [opts]
 *   phoneRequired defaults true (offline). Online gatherings may omit phone.
 */
export function parseGatheringContact(body, {
  emailKey = 'email',
  phoneKey = 'phone',
  phoneRequired = true,
} = {}) {
  const email = normalizeGatheringEmail(body?.[emailKey]);
  const phoneRaw = body?.[phoneKey];
  const phoneEmpty = phoneRaw == null || String(phoneRaw).trim() === '';
  const phone = phoneEmpty ? null : normalizeGatheringPhone(phoneRaw);
  const errors = [];
  if (!email) errors.push('請填寫有效電郵。');
  if (phoneRequired && !phone) {
    errors.push('請填寫有效電話（8–20 位數字，可含 +852）。');
  } else if (!phoneEmpty && !phone) {
    errors.push('電話格式無效（8–20 位數字，可含 +852）。');
  }
  return { ok: errors.length === 0, email, phone, error: errors[0] || null, errors };
}
