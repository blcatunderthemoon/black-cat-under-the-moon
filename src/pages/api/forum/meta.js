/**
 * GET /api/forum/meta — sidebar stats: gathering count + hot/curated sparks + tags
 */

import { getOptionalUser, getServiceOrUserClient } from '../../../lib/server-auth.js';
import { getHotForumTags } from '../../../lib/forum-tag-stats.js';
import {
  FORUM_POST_TOPICS,
  mergePresetTagsWithCounts,
  filterUserHotTags,
} from '../../../lib/forum-categories.js';
import { getStartOfWeekHongKongIso } from '../../../lib/hong-kong-time.js';
import { getMoonJourneyForUser } from '../../../lib/moon-journey.js';
import { applyExcludeMatureTopics, getMatureTopicDbValues } from '../../../lib/forum-mature.js';

const HOT_POST_LIMIT = 3;

const SPARK_SELECT = 'id, title, topic, like_count, comment_count, created_at, is_pinned, is_highlighted';

function mapSparkRow(p) {
  const likeCount = p.like_count || 0;
  const commentCount = p.comment_count || 0;
  return {
    id: p.id,
    title: p.title || p.topic,
    topic: p.topic,
    like_count: likeCount,
    comment_count: commentCount,
    activity_score: likeCount + commentCount,
    created_at: p.created_at,
    is_pinned: !!p.is_pinned,
    is_highlighted: !!p.is_highlighted,
  };
}

function stripSparkInternal(post) {
  const { activity_score, created_at, is_pinned, is_highlighted, ...rest } = post;
  return rest;
}

function mergeSparks(primary, extras, limit) {
  const out = [...primary];
  const seen = new Set(out.map((p) => p.id));
  for (const p of extras) {
    if (out.length >= limit) break;
    if (!p?.id || seen.has(p.id)) continue;
    if (getMatureTopicDbValues().includes(p.topic)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out.slice(0, limit);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = getServiceOrUserClient(req);
  const user = await getOptionalUser(req);
  const visibilityFilter = ['public', 'members_only'];

  const topicParam = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';
  const topic = FORUM_POST_TOPICS.includes(topicParam) ? topicParam : null;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const startOfWeek = getStartOfWeekHongKongIso();

  const [recentPostsRes, hotPostsRes, commentAuthorsRes, membersRes] = await Promise.all([
    applyExcludeMatureTopics(
      admin
        .from('forum_posts')
        .select('author_id')
        .in('visibility', visibilityFilter)
        .gte('created_at', oneDayAgo)
    ),
    applyExcludeMatureTopics(
      admin
        .from('forum_posts')
        .select(SPARK_SELECT)
        .in('visibility', visibilityFilter)
        .gte('created_at', startOfWeek)
        .order('created_at', { ascending: false })
        .limit(40)
    ),
    admin
      .from('forum_comments')
      .select('author_id')
      .gte('created_at', oneDayAgo),
    // Public-safe cumulative clan size
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'banned')
      .neq('status', 'suspended')
      .neq('status', 'deleted'),
  ]);

  const postAuthors = new Set((recentPostsRes.data || []).map((p) => p.author_id).filter(Boolean));
  const commentAuthors = new Set((commentAuthorsRes.data || []).map((c) => c.author_id).filter(Boolean));
  const gatheringCount = new Set([...postAuthors, ...commentAuthors]).size;

  const membersTotal = typeof membersRes.count === 'number' ? membersRes.count : 0;

  const hotPostRows = (hotPostsRes.data || []).filter((p) => !getMatureTopicDbValues().includes(p.topic));
  let weeklyHot = hotPostRows
    .map(mapSparkRow)
    .sort((a, b) => (
      b.activity_score - a.activity_score
      || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ))
    .slice(0, HOT_POST_LIMIT);

  let sparksMode = 'weekly';
  let sparks = weeklyHot;

  // Cold start: never leave sparks empty — fall back to pinned → highlighted → recent warm posts
  if (sparks.length < HOT_POST_LIMIT) {
    const need = HOT_POST_LIMIT - sparks.length;
    const [pinnedRes, highlightedRes] = await Promise.all([
      applyExcludeMatureTopics(
        admin
          .from('forum_posts')
          .select(SPARK_SELECT)
          .in('visibility', visibilityFilter)
          .eq('is_pinned', true)
          .order('pinned_at', { ascending: false, nullsFirst: false })
          .limit(HOT_POST_LIMIT + need)
      ),
      applyExcludeMatureTopics(
        admin
          .from('forum_posts')
          .select(SPARK_SELECT)
          .in('visibility', visibilityFilter)
          .eq('is_highlighted', true)
          .order('highlighted_at', { ascending: false, nullsFirst: false })
          .limit(HOT_POST_LIMIT + need)
      ),
    ]);

    const curated = [
      ...(pinnedRes.data || []).map(mapSparkRow),
      ...(highlightedRes.data || []).map(mapSparkRow),
    ];

    sparks = mergeSparks(sparks, curated, HOT_POST_LIMIT);

    if (sparks.length < HOT_POST_LIMIT) {
      const { data: recentWarm } = await applyExcludeMatureTopics(
        admin
          .from('forum_posts')
          .select(SPARK_SELECT)
          .in('visibility', visibilityFilter)
          .order('created_at', { ascending: false })
          .limit(24)
      );
      const warmSorted = (recentWarm || [])
        .map(mapSparkRow)
        .sort((a, b) => (
          b.activity_score - a.activity_score
          || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      sparks = mergeSparks(sparks, warmSorted, HOT_POST_LIMIT);
    }

    if (weeklyHot.length === 0 && sparks.length > 0) {
      sparksMode = 'curated';
    }
  }

  const hotPosts = sparks.map(stripSparkInternal);

  const skipMoonJourney = req.query.skip_moon_journey === '1';
  const moonJourneyPromise = !skipMoonJourney && user?.id
    ? getMoonJourneyForUser(admin, user.id).catch((err) => {
        console.error('[forum/meta] moon journey:', err?.message || err);
        return null;
      })
    : Promise.resolve(undefined);

  const [hotTags, moon_journey] = await Promise.all([
    getHotForumTags(admin, { topic, visibilityFilter, limit: 20 }),
    moonJourneyPromise,
  ]);

  const preset_tags = topic ? mergePresetTagsWithCounts(topic, hotTags) : [];
  const user_hot_tags = topic ? filterUserHotTags(topic, hotTags) : hotTags;

  return res.status(200).json({
    gathering_count: gatheringCount,
    members_total: membersTotal,
    hot_posts: hotPosts,
    sparks_mode: sparksMode,
    hot_tags: hotTags,
    preset_tags,
    user_hot_tags,
    ...(moon_journey !== undefined ? { moon_journey } : {}),
  });
}
