/**
 * Redirect match notification emails to a single test inbox during QA.
 * Set MATCH_TEST_EMAIL=lhuen2010@gmail.com in .env.local
 */

export function getMatchTestEmail() {
  return String(process.env.MATCH_TEST_EMAIL || '').trim().toLowerCase();
}

export function isMatchTestEmailMode() {
  return Boolean(getMatchTestEmail());
}

/**
 * @returns {{ to: string, redirected: boolean, original?: string }}
 */
export function applyMatchTestEmailRedirection(intendedEmail) {
  const to = String(intendedEmail || '').trim();
  const testEmail = getMatchTestEmail();
  if (!testEmail || !to) {
    return { to, redirected: false };
  }
  if (to.toLowerCase() === testEmail) {
    return { to, redirected: false };
  }
  return { to: testEmail, redirected: true, original: to };
}
