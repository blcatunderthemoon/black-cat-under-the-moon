/**

 * GET /api/forum/meta — sidebar stats: gathering count + hot posts + preset/user tags

 */



import { getOptionalUser, getAdminClient, getServiceOrUserClient } from '../../../lib/server-auth.js';

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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });



  const admin = getServiceOrUserClient(req);

  const user = await getOptionalUser(req);

  const visibilityFilter = ['public', 'members_only'];

  const topicParam = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';

  const topic = FORUM_POST_TOPICS.includes(topicParam) ? topicParam : null;



  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const startOfWeek = getStartOfWeekHongKongIso();



  const [recentPostsRes, hotPostsRes, commentAuthorsRes] = await Promise.all([

    applyExcludeMatureTopics(admin

      .from('forum_posts')

      .select('author_id')

      .in('visibility', visibilityFilter)

      .gte('created_at', oneDayAgo)),

    applyExcludeMatureTopics(admin

      .from('forum_posts')

      .select('id, title, topic, like_count, comment_count, created_at')

      .in('visibility', visibilityFilter)

      .gte('created_at', startOfWeek)

      .order('created_at', { ascending: false })

      .limit(40)),

    admin

      .from('forum_comments')

      .select('author_id')

      .gte('created_at', oneDayAgo),

  ]);



  const postAuthors = new Set((recentPostsRes.data || []).map((p) => p.author_id).filter(Boolean));

  const commentAuthors = new Set((commentAuthorsRes.data || []).map((c) => c.author_id).filter(Boolean));

  const allActive = new Set([...postAuthors, ...commentAuthors]);



  const gatheringCount = allActive.size;



  const hotPostRows = (hotPostsRes.data || []).filter((p) => !getMatureTopicDbValues().includes(p.topic));

  const hotPosts = hotPostRows

    .map((p) => {

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

      };

    })

    .sort((a, b) => (

      b.activity_score - a.activity_score

      || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    ))

    .slice(0, HOT_POST_LIMIT)

    .map(({ activity_score, created_at, ...post }) => post);



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

    hot_posts: hotPosts,

    hot_tags: hotTags,

    preset_tags,

    user_hot_tags,

    ...(moon_journey !== undefined ? { moon_journey } : {}),

  });

}


