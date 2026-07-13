/**
 * GET /api/forum/featured — public highlighted posts (月光精選)
 */

import { getServiceOrUserClient } from '../../../lib/server-auth.js';
import { mapForumPostListPreview } from '../../../lib/forum-list-preview.js';
import { getTagsByPostIds, getTagLabelMapForPosts } from '../../../lib/forum-tag-stats.js';
import { loadForumAuthorMeta, resolveForumPostAuthorDisplayName, isForumPostAnonymous } from '../../../lib/forum-author-names.js';
import { applyExcludeMatureTopics } from '../../../lib/forum-mature.js';

const FEATURED_LIMIT = 5;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = getServiceOrUserClient(req);
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=90');

  const { data: posts, error } = await applyExcludeMatureTopics(admin
    .from('forum_posts')
    .select(`
      id,
      author_id,
      title,
      content,
      topic,
      mood_tag,
      anonymous_name_snapshot,
      hide_username,
      like_count,
      comment_count,
      visibility,
      is_highlighted,
      highlighted_at,
      created_at
    `)
    .eq('is_highlighted', true)
    .eq('visibility', 'public')
    .order('highlighted_at', { ascending: false, nullsFirst: false })
    .limit(FEATURED_LIMIT));

  if (error) {
    if (error.code === '42703' || error.code === '42P01') {
      return res.status(200).json({ featured_posts: [] });
    }
    console.error('[forum/featured] failed:', error.message);
    return res.status(500).json({ error: 'Failed to load featured posts' });
  }

  const postIds = (posts || []).map((p) => p.id);
  const authorIds = [...new Set((posts || []).map((p) => p.author_id).filter(Boolean))];
  const tagsByPostIdPromise = getTagsByPostIds(admin, postIds);

  const [tagsByPostId, authorMeta, tagLabels] = await Promise.all([
    tagsByPostIdPromise,
    loadForumAuthorMeta(admin, authorIds),
    tagsByPostIdPromise.then((byPost) => getTagLabelMapForPosts(admin, byPost)),
  ]);

  const { names: authorNames, premium: authorPremium } = authorMeta;

  const featured = (posts || []).map((p) => {
    const hideUsername = isForumPostAnonymous(p);
    return mapForumPostListPreview({
      ...p,
      hide_username: hideUsername,
      anonymous_name_snapshot: resolveForumPostAuthorDisplayName({
        hideUsername,
        liveName: authorNames[p.author_id],
        snapshot: p.anonymous_name_snapshot,
      }),
      tags: tagsByPostId[p.id] || (p.mood_tag ? [p.mood_tag] : []),
      comment_count: p.comment_count ?? 0,
      is_mine: false,
      viewer_liked: false,
      viewer_bookmarked: false,
      author_is_premium: hideUsername ? false : !!authorPremium[p.author_id],
      author_mirror_type: null,
      author_mirror_slug: null,
      author_id: undefined,
      is_highlighted: true,
      members_gated: false,
    });
  });

  return res.status(200).json({ featured_posts: featured, tag_labels: tagLabels });
}
