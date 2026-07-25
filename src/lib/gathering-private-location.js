/**
 * Pure helpers for gathering private location — safe for client + server.
 */

/** Treat empty / dummy placeholders as “not filled” (≠ filled-but-hidden). */
const PRIVATE_LOCATION_PLACEHOLDER_RE = /^(no\s*link|n\/?a|暫無|未定|无|none|null|nil|-|—|－|\.+)$/i;

export function normalizeGatheringPrivateLocation(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || PRIVATE_LOCATION_PLACEHOLDER_RE.test(text)) return null;
  return text;
}
