/**
 * Official Moonlight Gathering #001 — featured on /gatherings calendar.
 * Signup flows through /moonlight-interest001 (not a DB gatherings row yet).
 *
 * Defaults live here; ops can override via `ops_settings` key
 * `moonlight_gathering_001` (dashboard /admin/moonlight-interest).
 */

export const MOONLIGHT_GATHERING_001_ID = 'moonlight-gathering-001';
export const MOONLIGHT_GATHERING_001_OPS_KEY = 'moonlight_gathering_001';

/** Code defaults — used when ops_settings has no row / table missing. */
export const MOONLIGHT_GATHERING_001_DEFAULTS = Object.freeze({
  title: 'Moonlight Gathering #001',
  capacity: 12,
  /** Remaining open seats (manual ops). approved = capacity − seats_left */
  seats_left: 8,
  starts_at: '2026-09-19T06:00:00.000Z', // 14:00 HKT
  ends_at: '2026-09-19T09:00:00.000Z', // 17:00 HKT
  starts_at_hk: '19/09/2026 (週六) 14:00',
  time_range_hk: '19/09/2026 (週六) 14:00–17:00',
  location_public: '線下小型聚會（詳見參加表）',
  host_name: 'Black Cat Under The Moon',
  href: '/moonlight-interest001',
  date_key: '2026-09-19',
});

/** @deprecated use MOONLIGHT_GATHERING_001_DEFAULTS.capacity */
export const MOONLIGHT_GATHERING_001_CAPACITY = MOONLIGHT_GATHERING_001_DEFAULTS.capacity;
/** @deprecated use MOONLIGHT_GATHERING_001_DEFAULTS.seats_left */
export const MOONLIGHT_GATHERING_001_SEATS_LEFT = MOONLIGHT_GATHERING_001_DEFAULTS.seats_left;
/** @deprecated use MOONLIGHT_GATHERING_001_DEFAULTS.date_key */
export const MOONLIGHT_GATHERING_001_DATE = MOONLIGHT_GATHERING_001_DEFAULTS.date_key;

function clampInt(n, lo, hi, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * Merge stored ops JSON with code defaults; sanitize numbers.
 * @param {Record<string, unknown>|null|undefined} raw
 */
export function normalizeMoonlightGathering001Config(raw) {
  const d = MOONLIGHT_GATHERING_001_DEFAULTS;
  const src = raw && typeof raw === 'object' ? raw : {};
  const capacity = clampInt(src.capacity ?? src.max_participants, 1, 100, d.capacity);
  let seatsLeft = clampInt(src.seats_left, 0, capacity, d.seats_left);
  if (src.approved_count != null && src.seats_left == null) {
    const approved = clampInt(src.approved_count, 0, capacity, Math.max(0, capacity - d.seats_left));
    seatsLeft = Math.max(0, capacity - approved);
  }
  seatsLeft = Math.max(0, Math.min(capacity, seatsLeft));

  return {
    title: String(src.title || d.title).trim() || d.title,
    capacity,
    seats_left: seatsLeft,
    starts_at: String(src.starts_at || d.starts_at),
    ends_at: String(src.ends_at || d.ends_at),
    starts_at_hk: String(src.starts_at_hk || d.starts_at_hk).trim() || d.starts_at_hk,
    time_range_hk: String(src.time_range_hk || d.time_range_hk).trim() || d.time_range_hk,
    location_public: String(src.location_public || d.location_public).trim() || d.location_public,
    host_name: String(src.host_name || d.host_name).trim() || d.host_name,
    href: String(src.href || d.href).trim() || d.href,
    date_key: String(src.date_key || d.date_key).trim() || d.date_key,
  };
}

export function capacityTagLabel(capacity) {
  return `${capacity} 人局`;
}

/**
 * @param {Date} [now]
 * @param {ReturnType<typeof normalizeMoonlightGathering001Config>|null} [config]
 */
export function buildMoonlightGathering001Card(now = new Date(), config = null) {
  const cfg = config || normalizeMoonlightGathering001Config(null);
  const max = cfg.capacity;
  const seatsLeft = cfg.seats_left;
  const approved = Math.max(0, max - seatsLeft);
  const isPast = now.getTime() > new Date(cfg.ends_at).getTime();

  return {
    id: MOONLIGHT_GATHERING_001_ID,
    title: cfg.title,
    status: isPast ? 'completed' : (seatsLeft <= 0 ? 'full' : 'open'),
    is_online: false,
    max_participants: max,
    approved_count: approved,
    seats_left: seatsLeft,
    starts_at: cfg.starts_at,
    ends_at: cfg.ends_at,
    starts_at_hk: cfg.starts_at_hk,
    time_range_hk: cfg.time_range_hk,
    location_public: cfg.location_public,
    tag_labels: ['官方', capacityTagLabel(max)],
    host: {
      display_name: cfg.host_name,
      family_zh: null,
    },
    href: cfg.href,
    featured: true,
    featured_label: '官方',
  };
}

/**
 * Load ops override from Supabase `ops_settings` (graceful if missing).
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 */
export async function loadMoonlightGathering001Config(admin) {
  if (!admin) return normalizeMoonlightGathering001Config(null);
  try {
    const { data, error } = await admin
      .from('ops_settings')
      .select('value')
      .eq('key', MOONLIGHT_GATHERING_001_OPS_KEY)
      .maybeSingle();
    if (error) {
      // Table missing / RLS — fall back to code defaults.
      if (error.code !== 'PGRST116') {
        console.warn('[moonlight-001] ops_settings read:', error.message, error.code);
      }
      return normalizeMoonlightGathering001Config(null);
    }
    return normalizeMoonlightGathering001Config(data?.value);
  } catch (err) {
    console.warn('[moonlight-001] ops_settings read failed:', err?.message || err);
    return normalizeMoonlightGathering001Config(null);
  }
}

export async function resolveMoonlightGathering001Card(admin, now = new Date()) {
  const config = await loadMoonlightGathering001Config(admin);
  return buildMoonlightGathering001Card(now, config);
}

/**
 * Persist ops override. Creates row if missing.
 * @returns {{ ok: true, config } | { ok: false, error: string, code?: string }}
 */
export async function saveMoonlightGathering001Config(admin, patch) {
  const current = await loadMoonlightGathering001Config(admin);
  const next = normalizeMoonlightGathering001Config({ ...current, ...patch });
  const { error } = await admin
    .from('ops_settings')
    .upsert(
      {
        key: MOONLIGHT_GATHERING_001_OPS_KEY,
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  if (error) {
    const missing = /ops_settings|schema cache|does not exist/i.test(error.message || '');
    return {
      ok: false,
      error: missing
        ? '尚未建立 ops_settings 表，請先執行 scripts/sql/ops-settings.sql'
        : (error.message || '儲存失敗'),
      code: error.code,
    };
  }
  return { ok: true, config: next };
}

/**
 * Merge featured #001 into a month’s gathering list when the month includes Sep 2026.
 * Pass `featuredCard` from resolveMoonlightGathering001Card when available.
 */
export function withFeaturedMoonlightGatherings(
  gatherings,
  year,
  month,
  now = new Date(),
  featuredCard = null,
) {
  const list = Array.isArray(gatherings) ? [...gatherings] : [];
  if (year !== 2026 || month !== 9) return list;

  const featured = featuredCard || buildMoonlightGathering001Card(now);
  const withoutDup = list.filter((g) => String(g?.id) !== featured.id);
  return [featured, ...withoutDup];
}

/** Compact teaser for Forum「社群活動」tile (sync defaults; prefer live card when fetched). */
export function getForumMoonlightGatheringTeaser(now = new Date(), card = null) {
  const c = card || buildMoonlightGathering001Card(now);
  if (c.status === 'completed') {
    return { href: '/gatherings', hint: '約人出沒', featured: false };
  }
  if (c.status === 'full') {
    return { href: c.href, hint: '已滿額', featured: true };
  }
  return {
    href: c.href,
    hint: `仲有 ${c.seats_left} 個位`,
    featured: true,
  };
}
