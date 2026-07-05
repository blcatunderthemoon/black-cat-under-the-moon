/**
 * Email + password validation for signup, login, and password changes.
 */

export const PASSWORD_MIN_LENGTH = 10;

/** Short hint for input placeholders */
export const PASSWORD_PLACEHOLDER = '輸入密碼';

/** Label for new-password fields (details shown in PasswordRequirementsChecklist) */
export const PASSWORD_REQUIREMENTS_LABEL = '新密碼';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_VALIDATION_ERRORS = {
  length: `密碼最少 ${PASSWORD_MIN_LENGTH} 個字元。`,
  lower: '密碼須包含至少一個小寫字母。',
  upper: '密碼須包含至少一個大寫字母。',
  digit: '密碼須包含至少一個數字。',
  symbol: '密碼須包含至少一個符號（如 !@#$）。',
};

export const PASSWORD_REQUIREMENTS = [
  {
    id: 'length',
    label: `至少 ${PASSWORD_MIN_LENGTH} 個字元`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'lower',
    label: '包含小寫字母',
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: 'upper',
    label: '包含大寫字母',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: 'digit',
    label: '包含數字',
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: 'symbol',
    label: '包含符號（如 !@#$）',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

/**
 * @param {string} password
 * @returns {Array<{ id: string, label: string, met: boolean }>}
 */
export function getPasswordRequirementStatus(password) {
  const value = String(password || '');
  return PASSWORD_REQUIREMENTS.map(({ id, label, test }) => ({
    id,
    label,
    met: test(value),
  }));
}

/**
 * @param {string} email
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateEmail(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) {
    return { ok: false, error: '請填寫 Email。' };
  }
  if (!trimmed.includes('@')) {
    return { ok: false, error: 'Email 必須包含 @ 符號。' };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Email 格式不正確，請重新輸入。' };
  }
  return { ok: true, value: trimmed.toLowerCase() };
}

/**
 * @param {string} password
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validatePassword(password) {
  const value = String(password || '');
  if (!value) {
    return { ok: false, error: '請填寫密碼。' };
  }
  const failed = getPasswordRequirementStatus(value).find((item) => !item.met);
  if (failed) {
    return { ok: false, error: PASSWORD_VALIDATION_ERRORS[failed.id] };
  }
  return { ok: true, value };
}
