/**
 * Public landing activity feed — recent forum posts, new members, new gatherings.
 * SERVER-SAFE only.
 */

import { isMatureForumTopic } from './forum-mature.js';
import { resolveForumPostAuthorDisplayName } from './forum-author-names.js';
import { DISPLAY_NAME_MAX_LENGTH } from './display-name-policy.js';
import { getHongKongDayStart } from './hong-kong-time.js';
import { isSystemChannelDisplayName } from './system-inbox.js';
import { SOLO_MATCH_ANCHOR_DISPLAY_NAME } from './inbox-solo-anchor.js';
import { resolveMoonlightGathering001Card } from './moonlight-gathering-001.js';

export const ACTIVITY_FEED_LIMIT = 8;
export const ACTIVITY_SOURCE_LIMIT = 8;
/** Prefer posts/gatherings on landing; members are secondary atmosphere. */
export const ACTIVITY_MEMBER_MAX = 2;
/** Forum posts older than this are omitted from the landing feed. */
export const ACTIVITY_POST_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @typedef {'post'|'member'|'gathering'} ActivityType
 * @typedef {{
 *   id: string,
 *   type: ActivityType,
 *   tag: string,
 *   text: string,
 *   href: string|null,
 *   created_at: string,
 *   pinned?: boolean,
 * }} ActivityItem
 */

function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function safeMemberName(raw) {
  const name = String(raw || '').trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  return name || '一位新旅人';
}

function isInternalSystemMemberName(raw) {
  const name = String(raw || '').trim();
  if (!name) return false;
  return isSystemChannelDisplayName(name) || name === SOLO_MATCH_ANCHOR_DISPLAY_NAME;
}

/**
 * Unfinished official Moonlight #001 → pinned first in landing feed.
 * @returns {Promise<ActivityItem|null>}
 */
async function loadPinnedOfficialGatheringActivity(admin) {
  try {
    const card = await resolveMoonlightGathering001Card(admin);
    if (!card || card.status === 'completed') return null;

    const title = clip(card.title, 28) || 'Moonlight Gathering';
    let text;
    if (card.status === 'full') {
      text = `官方活動已滿額：「${title}」`;
    } else if (typeof card.seats_left === 'number' && card.seats_left >= 0) {
      text = `官方活動招募中：「${title}」· 仲有 ${card.seats_left} 個位`;
    } else {
      text = `官方活動招募中：「${title}」`;
    }

    return {
      id: `gathering:${card.id}`,
      type: 'gathering',
      tag: '官方',
      text,
      href: card.href || '/gatherings',
      // Keep relatively fresh so it stays visually current; client skips toast when pinned.
      created_at: card.starts_at || new Date().toISOString(),
      pinned: true,
    };
  } catch (err) {
    console.warn('[site-activity] official pin:', err?.message || err);
    return null;
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @returns {Promise<ActivityItem[]>}
 */
export async function loadPublicActivityFeed(admin) {
  const memberSinceIso = getHongKongDayStart().toISOString();
  const postSinceIso = new Date(Date.now() - ACTIVITY_POST_MAX_AGE_MS).toISOString();

  const [postsRes, membersRes, gatheringsRes, pinnedOfficial] = await Promise.all([
    admin
      .from('forum_posts')
      .select('id, title, topic, created_at, hide_username, anonymous_name_snapshot')
      .eq('visibility', 'public')
      .gte('created_at', postSinceIso)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_SOURCE_LIMIT),
    admin
      .from('profiles')
      .select('id, display_name, created_at, status')
      .not('display_name', 'is', null)
      .neq('display_name', '')
      .gte('created_at', memberSinceIso)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_SOURCE_LIMIT),
    admin
      .from('gatherings')
      .select('id, title, created_at, starts_at, is_online, status, is_hidden')
      .eq('is_hidden', false)
      .in('status', ['open', 'full'])
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_SOURCE_LIMIT),
    loadPinnedOfficialGatheringActivity(admin),
  ]);

  const posts = postsRes.error ? [] : (postsRes.data || []);
  const members = membersRes.error ? [] : (membersRes.data || []);
  const gatherings = gatheringsRes.error ? [] : (gatheringsRes.data || []);

  if (postsRes.error) console.warn('[site-activity] posts:', postsRes.error.message);
  if (membersRes.error) console.warn('[site-activity] members:', membersRes.error.message);
  if (gatheringsRes.error) console.warn('[site-activity] gatherings:', gatheringsRes.error.message);

  /** @type {ActivityItem[]} */
  const items = [];

  for (const row of posts) {
    if (!row?.id || isMatureForumTopic(row.topic)) continue;
    const created = new Date(row.created_at).getTime();
    if (!Number.isFinite(created) || created < Date.now() - ACTIVITY_POST_MAX_AGE_MS) continue;
    const title = clip(row.title, 36);
    if (!title) continue;
    const author = resolveForumPostAuthorDisplayName({
      hideUsername: !!row.hide_username,
      snapshot: row.anonymous_name_snapshot,
    });
    items.push({
      id: `post:${row.id}`,
      type: 'post',
      tag: '論壇',
      text: author ? `${author} 發佈咗「${title}」` : `新帖子：「${title}」`,
      href: `/forum/${row.id}`,
      created_at: row.created_at,
    });
  }

  const hkDayStartMs = getHongKongDayStart().getTime();
  for (const row of members) {
    if (!row?.id) continue;
    const status = String(row.status || '').toLowerCase();
    if (status === 'banned' || status === 'suspended' || status === 'deleted') continue;
    if (isInternalSystemMemberName(row.display_name)) continue;
    const joinedAt = new Date(row.created_at).getTime();
    if (!Number.isFinite(joinedAt) || joinedAt < hkDayStartMs) continue;
    const name = safeMemberName(row.display_name);
    items.push({
      id: `member:${row.id}`,
      type: 'member',
      tag: '新會員',
      text: `${name} 加入咗月下`,
      href: null,
      created_at: row.created_at,
    });
  }

  const pinnedId = pinnedOfficial?.id || null;
  for (const row of gatherings) {
    if (!row?.id) continue;
    if (pinnedId && `gathering:${row.id}` === pinnedId) continue;
    const title = clip(row.title, 36);
    if (!title) continue;
    const where = row.is_online ? '線上' : '線下';
    items.push({
      id: `gathering:${row.id}`,
      type: 'gathering',
      tag: '活動',
      text: `新${where}聚會：「${title}」`,
      href: `/gatherings/${row.id}`,
      created_at: row.created_at,
    });
  }

  items.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  // Cap member rows so the feed doesn't read as a signup board.
  let memberKept = 0;
  const balanced = [];
  for (const item of items) {
    if (item.type === 'member') {
      if (memberKept >= ACTIVITY_MEMBER_MAX) continue;
      memberKept += 1;
    }
    balanced.push(item);
    if (balanced.length >= ACTIVITY_FEED_LIMIT) break;
  }

  // Official unfinished gathering stays slot #1 until completed.
  if (pinnedOfficial) {
    const rest = balanced.filter((item) => item.id !== pinnedOfficial.id);
    return [pinnedOfficial, ...rest].slice(0, ACTIVITY_FEED_LIMIT);
  }

  return balanced;
}
