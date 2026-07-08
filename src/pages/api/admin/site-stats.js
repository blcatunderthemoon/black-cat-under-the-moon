/**
 * GET /api/admin/site-stats — basic site metrics (forum admin or dashboard key).
 */

import { getAdminClient } from '../../../lib/server-auth.js';
import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';
import { getHongKongMonthStart } from '../../../lib/hong-kong-time.js';
import { STORY_TOPIC } from '../../../lib/forum-story.js';

async function countExact(admin, table, buildQuery) {
  try {
    let q = admin.from(table).select('id', { count: 'exact', head: true });
    if (buildQuery) q = buildQuery(q);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await authorizeStationOrForumAdmin(req, res))) return;

  const admin = getAdminClient();
  const monthStart = getHongKongMonthStart().toISOString();

  const [
    membersTotal,
    membersThisMonth,
    questionnaires,
    forumPosts,
    forumComments,
    storyPosts,
    premiumMembers,
    reportedPosts,
    reportedComments,
  ] = await Promise.all([
    countExact(admin, 'profiles', (q) => q.neq('status', 'banned')),
    countExact(admin, 'profiles', (q) => q.gte('created_at', monthStart).neq('status', 'banned')),
    countExact(admin, 'responses'),
    countExact(admin, 'forum_posts', (q) => q.neq('visibility', 'hidden')),
    countExact(admin, 'forum_comments', (q) => q.eq('is_hidden', false)),
    countExact(admin, 'forum_posts', (q) => q.eq('topic', STORY_TOPIC).neq('visibility', 'hidden')),
    countExact(admin, 'profiles', (q) => q.eq('subscription_tier', 'premium').neq('status', 'banned')),
    countExact(admin, 'forum_posts', (q) => q.gte('report_count', 1).neq('visibility', 'hidden')),
    countExact(admin, 'forum_comments', (q) => q.gte('report_count', 1).eq('is_hidden', false)),
  ]);

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    members_total: membersTotal,
    members_this_month: membersThisMonth,
    questionnaires_total: questionnaires,
    forum_posts_total: forumPosts,
    forum_comments_total: forumComments,
    story_posts_total: storyPosts,
    premium_members_total: premiumMembers,
    pending_reports_total: (reportedPosts ?? 0) + (reportedComments ?? 0),
    pending_posts: reportedPosts,
    pending_comments: reportedComments,
  });
}
