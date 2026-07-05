const STORAGE_KEY = 'bcutm_remember_login';

export function loadRememberLogin() {
  if (typeof window === 'undefined') return { remember: false, email: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { remember: false, email: '' };
    const data = JSON.parse(raw);
    if (!data?.remember || !data?.email) return { remember: false, email: '' };
    return { remember: true, email: String(data.email) };
  } catch {
    return { remember: false, email: '' };
  }
}

export function saveRememberLogin(remember, email) {
  if (typeof window === 'undefined') return;
  try {
    if (remember && email?.trim()) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ remember: true, email: email.trim() })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}
