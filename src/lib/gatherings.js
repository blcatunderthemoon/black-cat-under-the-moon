/**
 * Moonlight Gatherings — core business logic (Phase 1 MVP).
 * Spec: docs/MOONLIGHT-GATHERINGS-PLAN.md
 * SERVER-SAFE (no React). Client pages may import constants / pure helpers.
 */

import { TYPE_ORDER, getFamilyNameZh } from './mirror-personality.js';
import { normalizeGatheringTags, gatheringTagLabels, GATHERING_TAG_LABEL_BY_ID } from './gathering-tags.js';
import { normalizeGatheringPublicLocation } from './gathering-districts.js';
import { parseGatheringContact } from './gathering-contact.js';
import { HK_TZ, databaseNowIso } from './hong-kong-time.js';
import { filterContent } from './content-filter.js';
import { isBlocked } from './permissions.js';
import { getMoonJourneyForUser } from './moon-journey.js';

/** @deprecated Platform no longer gates hosting by level — any logged-in member may host. */
export const GATHERING_HOST_MIN_LEVEL = 1;
export const GATHERING_OPEN_HOST_LIMIT = 2;
export const GATHERING_MONTHLY_HOST_LIMIT = 4;
export const GATHERING_DEFAULT_MAX_PARTICIPANTS = 8;
export const GATHERING_DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
export const GATHERING_KNOCK_QUESTION_MAX_LEN = 80;

export const GATHERING_STATUSES = ['draft', 'open', 'full', 'completed', 'cancelled'];
export const ATTENDEE_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn', 'waitlist'];

const FAMILY_SET = new Set(TYPE_ORDER);

export function normalizeMirrorFamilies(input) {
  if (input == null) return null;
  if (!Array.isArray(input) || input.length === 0) return null;
  const out = [];
  for (const raw of input) {
    const id = String(raw || '').trim();
    if (!FAMILY_SET.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out.length ? out : null;
}

export function formatGatheringHkTime(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('zh-HK', {
      timeZone: HK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export function tagLabelsForIds(tagIds) {
  return gatheringTagLabels(tagIds);
}

/**
 * @returns {Promise<{ ok: true, profile: object, mirrorType: string|null, level: number } | { ok: false, status: number, error: string, code?: string }>}
 */
export async function loadGatheringActor(admin, userId) {
  const [{ data: profile }, { data: mirror }, journey] = await Promise.all([
    admin.from('profiles').select('id, display_name, status, moon_journey_level').eq('id', userId).maybeSingle(),
    admin.from('mirror_cards').select('mirror_type, shadow_type').eq('user_id', userId).maybeSingle(),
    getMoonJourneyForUser(admin, userId),
  ]);

  if (!profile) {
    return { ok: false, status: 403, error: '找不到用戶資料。', code: 'profile_missing' };
  }
  if (profile.status === 'suspended' || profile.status === 'limited') {
    return { ok: false, status: 403, error: '你的帳號目前受到限制。', code: 'account_restricted' };
  }

  return {
    ok: true,
    profile,
    mirrorType: mirror?.mirror_type || null,
    shadowType: mirror?.shadow_type || null,
    level: journey?.level ?? profile.moon_journey_level ?? 1,
  };
}

/** Any active website member may host (login + profile already checked via loadGatheringActor). */
export function assertCanHost(actor) {
  if (!actor?.profile?.id) {
    return { ok: false, status: 403, error: '請先登入後再發起聚會。', code: 'login_required' };
  }
  return { ok: true };
}

/** Any active website member may apply (plus gathering state / block checks elsewhere). */
export function assertCanApply(actor, gathering) {
  if (!actor?.profile?.id) {
    return { ok: false, status: 403, error: '請先登入後再報名聚會。', code: 'login_required' };
  }
  if (gathering.host_id === actor.profile.id) {
    return { ok: false, status: 400, error: '主辦人唔使報名自己的聚會。', code: 'is_host' };
  }
  if (gathering.status !== 'open') {
    return { ok: false, status: 409, error: '此聚會目前無法接受申請。', code: 'not_open' };
  }
  if (new Date(gathering.starts_at).getTime() <= Date.now()) {
    return { ok: false, status: 409, error: '聚會已經開始或結束。', code: 'started' };
  }
  return { ok: true };
}

/**
 * Validate + normalize create/update payload.
 */
export function validateGatheringInput(body = {}, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < 4 || title.length > 40) errors.push('標題需 4–40 字。');
    else {
      const f = filterContent(title);
      if (f.blocked) {
        return f.crisis
          ? { ok: false, status: 451, error: 'crisis', crisis: true }
          : { ok: false, status: 422, error: '標題包含不允許的詞語。' };
      }
      out.title = title;
    }
  }

  if (!partial || body.description !== undefined) {
    const description = body.description == null || body.description === ''
      ? null
      : String(body.description).trim();
    if (description && description.length > 800) errors.push('描述最多 800 字。');
    else if (description) {
      const f = filterContent(description);
      if (f.blocked) {
        return f.crisis
          ? { ok: false, status: 451, error: 'crisis', crisis: true }
          : { ok: false, status: 422, error: '描述包含不允許的詞語。' };
      }
      out.description = description;
    } else {
      out.description = null;
    }
  }

  if (!partial || body.tags !== undefined) {
    const tags = normalizeGatheringTags(body.tags);
    for (const tag of tags) {
      if (GATHERING_TAG_LABEL_BY_ID[tag]) continue;
      const f = filterContent(tag);
      if (f.blocked) {
        return f.crisis
          ? { ok: false, status: 451, error: 'crisis', crisis: true }
          : { ok: false, status: 422, error: '自訂標籤包含不允許的詞語。' };
      }
    }
    out.tags = tags;
  }

  if (!partial || body.is_online !== undefined) {
    out.is_online = !!body.is_online;
  }

  if (!partial || body.starts_at !== undefined) {
    const starts = new Date(body.starts_at);
    if (!body.starts_at || Number.isNaN(starts.getTime())) errors.push('請提供有效開始時間。');
    else if (starts.getTime() <= Date.now() + 30 * 60 * 1000) {
      errors.push('開始時間需至少遲過而家 30 分鐘。');
    } else {
      out.starts_at = starts.toISOString();
    }
  }

  if (!partial || body.ends_at !== undefined || out.starts_at) {
    const startIso = out.starts_at || body.starts_at;
    if (body.ends_at) {
      const ends = new Date(body.ends_at);
      if (Number.isNaN(ends.getTime())) errors.push('結束時間無效。');
      else if (startIso && ends.getTime() <= new Date(startIso).getTime()) {
        errors.push('結束時間需遲過開始時間。');
      } else {
        out.ends_at = ends.toISOString();
      }
    } else if (!partial && startIso) {
      out.ends_at = new Date(new Date(startIso).getTime() + GATHERING_DEFAULT_DURATION_MS).toISOString();
    } else if (partial && body.ends_at === null) {
      out.ends_at = null;
    }
  }

  if (!partial || body.location_public !== undefined) {
    const locationPublic = normalizeGatheringPublicLocation(body.location_public);
    if (!locationPublic) errors.push('請選擇公開區域（18 區或線上）。');
    else out.location_public = locationPublic;
  }

  if (!partial || body.location_private !== undefined) {
    const locationPrivate = body.location_private == null || body.location_private === ''
      ? null
      : String(body.location_private).trim();
    if (locationPrivate && locationPrivate.length > 500) errors.push('私密地址／連結最多 500 字。');
    else out.location_private = locationPrivate;
  }

  if (!partial || body.host_email !== undefined || body.host_phone !== undefined || body.email !== undefined || body.phone !== undefined) {
    const isOnline = out.is_online != null ? out.is_online : !!body.is_online;
    const contact = parseGatheringContact({
      email: body.host_email ?? body.email,
      phone: body.host_phone ?? body.phone,
    }, { phoneRequired: !isOnline });
    if (!contact.ok) errors.push(contact.error);
    else {
      out.host_email = contact.email;
      out.host_phone = contact.phone;
    }
  }

  if (!partial || body.max_participants !== undefined) {
    const max = Number(body.max_participants ?? GATHERING_DEFAULT_MAX_PARTICIPANTS);
    if (!Number.isInteger(max) || max < 2 || max > 30) errors.push('人數上限需為 2–30。');
    else out.max_participants = max;
  }

  if (!partial || body.approval_mode !== undefined) {
    const mode = body.approval_mode || 'manual';
    if (mode !== 'manual' && mode !== 'auto') errors.push('審批模式無效。');
    else out.approval_mode = mode;
  }

  if (!partial || body.require_knock_message !== undefined) {
    out.require_knock_message = body.require_knock_message !== false;
  }

  if (!partial || body.knock_question !== undefined || body.require_knock_message !== undefined) {
    const requireKnock = out.require_knock_message !== undefined
      ? out.require_knock_message
      : body.require_knock_message !== false;
    const rawQ = body.knock_question == null ? '' : String(body.knock_question).trim();

    if (!requireKnock) {
      out.knock_question = null;
    } else if (rawQ.length < 2 || rawQ.length > GATHERING_KNOCK_QUESTION_MAX_LEN) {
      errors.push(`敲門問題需為 2–${GATHERING_KNOCK_QUESTION_MAX_LEN} 字。`);
    } else {
      const fq = filterContent(rawQ);
      if (fq.blocked) {
        return fq.crisis
          ? { ok: false, status: 451, error: 'crisis', crisis: true }
          : { ok: false, status: 422, error: '敲門問題包含不允許的詞語。' };
      }
      out.knock_question = rawQ;
    }
  }

  if (!partial || body.allowed_mirror_families !== undefined) {
    out.allowed_mirror_families = normalizeMirrorFamilies(body.allowed_mirror_families);
  }

  if (!partial || body.min_moon_level !== undefined) {
    const lvl = Number(body.min_moon_level ?? 1);
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 7) errors.push('最低月光等級需為 1–7。');
    else out.min_moon_level = lvl;
  }

  if (!partial || body.premium_only !== undefined) {
    out.premium_only = !!body.premium_only;
  }

  if (errors.length) return { ok: false, status: 400, error: errors[0], errors };
  return { ok: true, data: out };
}

export async function countOpenHostedGatherings(admin, hostId) {
  const { count } = await admin
    .from('gatherings')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId)
    .in('status', ['open', 'full']);
  return count ?? 0;
}

export async function countHostedThisHkMonth(admin, hostId) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const monthStart = `${year}-${month}-01T00:00:00+08:00`;

  const { count } = await admin
    .from('gatherings')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId)
    .gte('created_at', monthStart)
    .neq('status', 'draft');
  return count ?? 0;
}

/**
 * Recount approved attendees and sync gatherings.approved_count / open|full.
 * Safe to call even if the DB trigger is missing.
 */
export async function syncGatheringApprovedCount(admin, gatheringId) {
  const { count, error: countErr } = await admin
    .from('gathering_attendees')
    .select('id', { count: 'exact', head: true })
    .eq('gathering_id', gatheringId)
    .eq('status', 'approved');

  if (countErr) {
    console.error('[gatherings] count approved failed:', countErr.message);
    return null;
  }

  const cnt = count ?? 0;
  const { data: row, error: rowErr } = await admin
    .from('gatherings')
    .select('id, max_participants, status')
    .eq('id', gatheringId)
    .maybeSingle();

  if (rowErr || !row) {
    console.error('[gatherings] sync load failed:', rowErr?.message);
    return null;
  }

  const patch = {
    approved_count: cnt,
    updated_at: databaseNowIso(),
  };

  if (row.status !== 'cancelled' && row.status !== 'completed') {
    if (cnt >= (row.max_participants || 0)) patch.status = 'full';
    else if (row.status === 'full') patch.status = 'open';
  }

  const { data, error } = await admin
    .from('gatherings')
    .update(patch)
    .eq('id', gatheringId)
    .select('*')
    .single();

  if (error) {
    console.error('[gatherings] sync approved_count failed:', error.message);
    return null;
  }
  return data;
}

/** Strip secrets for public API payloads. */
export function toPublicGathering(row, {
  myAttendance = null,
  host = null,
  includePrivate = false,
} = {}) {
  if (!row) return null;
  const approvedCount = row.approved_count ?? 0;
  const max = row.max_participants ?? GATHERING_DEFAULT_MAX_PARTICIPANTS;
  return {
    id: row.id,
    host_id: row.host_id,
    host: host
      ? {
        id: host.id,
        display_name: host.display_name || '匿名貓咪',
        mirror_type: host.mirror_type || null,
        family_zh: host.mirror_type ? getFamilyNameZh(host.mirror_type) : null,
      }
      : undefined,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    tag_labels: tagLabelsForIds(row.tags),
    is_online: !!row.is_online,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    starts_at_hk: formatGatheringHkTime(row.starts_at),
    ends_at_hk: formatGatheringHkTime(row.ends_at),
    timezone: row.timezone || HK_TZ,
    location_public: row.location_public,
    location_private: includePrivate ? (row.location_private || null) : undefined,
    // host_email / host_phone: never public — stored for ops / host–attendee coordination only
    max_participants: max,
    approved_count: approvedCount,
    seats_left: Math.max(0, max - approvedCount),
    approval_mode: row.approval_mode,
    require_knock_message: !!row.require_knock_message,
    knock_question: row.knock_question || null,
    allowed_mirror_families: row.allowed_mirror_families,
    min_moon_level: row.min_moon_level,
    premium_only: !!row.premium_only,
    status: lazyUpdateStatus(row),
    my_attendance: myAttendance
      ? {
        status: myAttendance.status,
        knock_message: myAttendance.knock_message || null,
      }
      : null,
    created_at: row.created_at,
  };
}

/** Lazy: mark past open/full gatherings as completed in the payload (DB cron later). */
export function lazyUpdateStatus(row) {
  if (!row) return 'open';
  if (row.status === 'cancelled' || row.status === 'completed' || row.status === 'draft') {
    return row.status;
  }
  const end = row.ends_at || row.starts_at;
  if (end && new Date(end).getTime() < Date.now()) return 'completed';
  return row.status;
}

export async function maybeMarkCompleted(admin, row) {
  const status = lazyUpdateStatus(row);
  if (status === 'completed' && row.status !== 'completed' && row.status !== 'cancelled') {
    await admin.from('gatherings').update({
      status: 'completed',
      updated_at: databaseNowIso(),
    }).eq('id', row.id);
    return { ...row, status: 'completed' };
  }
  return row;
}

export async function enrichHosts(admin, gatherings) {
  const hostIds = [...new Set((gatherings || []).map((g) => g.host_id).filter(Boolean))];
  if (!hostIds.length) return new Map();

  const [{ data: profiles }, { data: mirrors }] = await Promise.all([
    admin.from('profiles').select('id, display_name').in('id', hostIds),
    admin.from('mirror_cards').select('user_id, mirror_type').in('user_id', hostIds),
  ]);

  const mirrorByUser = new Map((mirrors || []).map((m) => [m.user_id, m.mirror_type]));
  const map = new Map();
  for (const p of profiles || []) {
    map.set(p.id, {
      id: p.id,
      display_name: p.display_name,
      mirror_type: mirrorByUser.get(p.id) || null,
    });
  }
  return map;
}

export async function getAttendanceMap(admin, gatheringIds, userId) {
  if (!userId || !gatheringIds?.length) return new Map();
  const { data } = await admin
    .from('gathering_attendees')
    .select('gathering_id, status, knock_message')
    .eq('user_id', userId)
    .in('gathering_id', gatheringIds);
  return new Map((data || []).map((row) => [row.gathering_id, row]));
}

export async function canViewPrivateLocation(admin, gathering, userId) {
  if (!userId || !gathering) return false;
  if (gathering.host_id === userId) return true;
  const { data } = await admin
    .from('gathering_attendees')
    .select('status')
    .eq('gathering_id', gathering.id)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.status === 'approved';
}

export async function assertNotBlockedWithHost(hostId, userId) {
  if (!hostId || !userId || hostId === userId) return { ok: true };
  const blocked = await isBlocked(hostId, userId);
  if (blocked) {
    return { ok: false, status: 403, error: '暫時無法申請此聚會。', code: 'blocked' };
  }
  return { ok: true };
}

export { GATHERING_TAG_LABEL_BY_ID, normalizeGatheringTags, gatheringTagLabels };
