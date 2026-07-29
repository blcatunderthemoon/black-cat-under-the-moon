/**
 * Official Moonlight Gathering #001 — featured on /gatherings calendar.
 * Signup flows through /moonlight-interest001 (not a DB gatherings row yet).
 */

export const MOONLIGHT_GATHERING_001_DATE = '2026-09-19';
export const MOONLIGHT_GATHERING_001_CAPACITY = 12;
/** Remaining open seats shown on calendar (manual ops update). */
export const MOONLIGHT_GATHERING_001_SEATS_LEFT = 9;

export function buildMoonlightGathering001Card(now = new Date()) {
  const max = MOONLIGHT_GATHERING_001_CAPACITY;
  const seatsLeft = Math.max(0, Math.min(max, MOONLIGHT_GATHERING_001_SEATS_LEFT));
  const approved = Math.max(0, max - seatsLeft);
  const startsAt = '2026-09-19T06:00:00.000Z'; // 14:00 HKT
  const endsAt = '2026-09-19T09:00:00.000Z'; // 17:00 HKT
  const isPast = now.getTime() > new Date(endsAt).getTime();

  return {
    id: 'moonlight-gathering-001',
    title: 'Moonlight Gathering #001',
    status: isPast ? 'completed' : (seatsLeft <= 0 ? 'full' : 'open'),
    is_online: false,
    max_participants: max,
    approved_count: approved,
    seats_left: seatsLeft,
    starts_at: startsAt,
    ends_at: endsAt,
    starts_at_hk: '19/09/2026 (週六) 14:00',
    time_range_hk: '19/09/2026 (週六) 14:00–17:00',
    location_public: '線下小型聚會（詳見參加表）',
    tag_labels: ['官方', '12 人局'],
    host: {
      display_name: 'Black Cat Under The Moon',
      family_zh: null,
    },
    href: '/moonlight-interest001',
    featured: true,
    featured_label: '官方',
  };
}

/**
 * Merge featured #001 into a month’s gathering list when the month includes Sep 2026.
 */
export function withFeaturedMoonlightGatherings(gatherings, year, month, now = new Date()) {
  const list = Array.isArray(gatherings) ? [...gatherings] : [];
  if (year !== 2026 || month !== 9) return list;

  const featured = buildMoonlightGathering001Card(now);
  const withoutDup = list.filter((g) => String(g?.id) !== featured.id);
  return [featured, ...withoutDup];
}
