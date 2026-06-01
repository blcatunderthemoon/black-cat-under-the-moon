/**
 * lib/matching.js
 * Canonical home of all pure matching functions.
 * Imported by pages/api/match.js and all dashboard API routes.
 */

// ======================== 工具函式 ========================

/**
 * 把 DB 中以「, 」分隔的多選字串拆成 Set
 */
export function parseCSV(str) {
  if (!str) return new Set();
  return new Set(str.split(',').map((s) => s.trim()).filter(Boolean));
}

/**
 * 解析 ideal_height_gap / ideal_age_gap
 * DB 存的格式為 JSON 字串 "[min,max]" 或 null（代表冇所謂）
 */
export function parseRange(raw) {
  if (raw == null) return null;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length === 2) {
      return { min: Number(arr[0]), max: Number(arr[1]) };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 從 bed_role 字串中提取角色關鍵字
 */
export function getBedRole(str) {
  if (!str) return 'unknown';
  if (str.includes('Top')) return 'Top';
  if (str.includes('Bottom')) return 'Bottom';
  if (str.includes('Switch')) return 'Switch';
  return 'neutral';
}

// ======================== Hard Filter ========================

export function passesIdentityFilter(user, candidate) {
  const userIdeal = parseCSV(user.ideal_identity);
  const candidateIdeal = parseCSV(candidate.ideal_identity);
  const userAcceptsCandidate = userIdeal.has('冇所謂') || userIdeal.has(candidate.identity);
  const candidateAcceptsUser = candidateIdeal.has('冇所謂') || candidateIdeal.has(user.identity);
  return userAcceptsCandidate && candidateAcceptsUser;
}

export function passesBodyTypeFilter(user, candidate) {
  const userPref = parseCSV(user.ideal_appearance);
  const candidatePref = parseCSV(candidate.ideal_appearance);
  const userAccepts = userPref.size === 0 || userPref.has('冇所謂') || userPref.has(candidate.body_type);
  const candidateAccepts = candidatePref.size === 0 || candidatePref.has('冇所謂') || candidatePref.has(user.body_type);
  return userAccepts && candidateAccepts;
}

export function passesHeightFilter(user, candidate) {
  if (user.height == null || candidate.height == null) return true;
  const cRange = parseRange(candidate.ideal_height_gap);
  if (cRange != null) {
    const diff = user.height - candidate.height;
    if (diff < cRange.min || diff > cRange.max) return false;
  }
  const uRange = parseRange(user.ideal_height_gap);
  if (uRange != null) {
    const diff = candidate.height - user.height;
    if (diff < uRange.min || diff > uRange.max) return false;
  }
  return true;
}

export function passesAgeFilter(user, candidate) {
  if (user.age == null || candidate.age == null) return true;
  const cRange = parseRange(candidate.ideal_age_gap);
  if (cRange != null) {
    const diff = user.age - candidate.age;
    if (diff < cRange.min || diff > cRange.max) return false;
  }
  const uRange = parseRange(user.ideal_age_gap);
  if (uRange != null) {
    const diff = candidate.age - user.age;
    if (diff < uRange.min || diff > uRange.max) return false;
  }
  return true;
}

/**
 * Check if user has acceptable conduct score (>= 50)
 * Users with conduct_score < 50 are suspended from matching
 */
export function passesConductFilter(user) {
  const score = user.conduct_score ?? 100;
  return score >= 50;
}

export function passesHardFilter(user, candidate) {
  return (
    passesConductFilter(user) &&
    passesConductFilter(candidate) &&
    passesIdentityFilter(user, candidate) &&
    passesBodyTypeFilter(user, candidate) &&
    passesHeightFilter(user, candidate) &&
    passesAgeFilter(user, candidate)
  );
}
