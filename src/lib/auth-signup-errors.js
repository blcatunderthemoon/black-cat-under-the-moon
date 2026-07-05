/**
 * Detect duplicate signup attempts from Supabase responses.
 */

export function isDuplicateSignupError(error, data) {
  if (!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return true;
  }
  if (!error) return false;

  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toLowerCase();

  return (
    code === 'user_already_exists'
    || code === 'email_exists'
    || message.includes('already registered')
    || message.includes('user already registered')
    || message.includes('email address is already registered')
    || message.includes('already been registered')
  );
}

export const DUPLICATE_EMAIL_ERROR = '此 Email 已被使用，請直接登入。';
