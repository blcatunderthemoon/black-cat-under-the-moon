/**
 * Notify forum moderators when report threshold is reached (Inbox system message).
 */

import { REPORT_MODERATOR_NOTIFY_THRESHOLD } from './moderation.js';
import { getModeratorsForStoredTopic } from './forum-moderator-assignments.js';
import { getAdminClient } from './server-auth.js';
import { forumListPreviewText } from './forum-list-preview.js';
import { sendSystemInboxMessage } from './system-inbox.js';

const ALERT_DEDUP_MS = 24 * 60 * 60 * 1000;

async function wasAlertSentRecently(admin, targetType, targetId) {
  const since = new Date(Date.now() - ALERT_DEDUP_MS).toISOString();
  const { data } = await admin
    .from('inbox_messages')
    .select('id')
    .eq('message_type', 'system')
    .gte('created_at', since)
    .filter('payload->>kind', 'eq', 'forum_moderation_alert')
    .filter('payload->>target_type', 'eq', targetType)
    .filter('payload->>target_id', 'eq', targetId)
    .limit(1);

  return (data || []).length > 0;
}

/**
 * @returns {Promise<boolean>} whether any alert was sent
 */
export async function notifyForumModerators({
  targetType,
  targetId,
  reportCount,
  postTitle,
  preview,
  forumUrl,
  storedTopic,
}) {
  if ((reportCount || 0) < REPORT_MODERATOR_NOTIFY_THRESHOLD) return false;

  const admin = getAdminClient();

  if (await wasAlertSentRecently(admin, targetType, targetId)) {
    return false;
  }

  const moderators = storedTopic
    ? await getModeratorsForStoredTopic(admin, storedTopic)
    : (await admin
      .from('profiles')
      .select('id')
      .in('forum_role', ['moderator', 'admin'])
      .eq('status', 'active')).data || [];

  if (!moderators?.length) return false;

  const payload = {
    kind: 'forum_moderation_alert',
    target_type: targetType,
    target_id: targetId,
    report_count: reportCount,
    post_title: postTitle || null,
    preview: preview || null,
    forum_url: forumUrl || null,
  };

  const content = targetType === 'post'
    ? `🛡️ 有貼文收到 ${reportCount} 次檢舉，待月光守護者處理。${postTitle ? `「${String(postTitle).slice(0, 40)}」` : ''}`
    : `🛡️ 有留言收到 ${reportCount} 次檢舉，待月光守護者處理。`;

  let sent = false;

  for (const mod of moderators) {
    const ok = await sendSystemInboxMessage({
      channel: 'forum_moderation',
      userId: mod.id,
      content,
      payload,
    });
    if (ok) sent = true;
  }

  return sent;
}

export async function buildReportNotifyContext(admin, targetType, targetId) {
  if (targetType === 'post') {
    const { data: post } = await admin
      .from('forum_posts')
      .select('id, title, content, topic')
      .eq('id', targetId)
      .maybeSingle();
    if (!post) return {};
    return {
      postTitle: post.title,
      preview: forumListPreviewText(post.content, { maxLength: 120 }),
      forumUrl: `/forum/${post.id}`,
      storedTopic: post.topic,
    };
  }

  const { data: comment } = await admin
    .from('forum_comments')
    .select('id, content, post_id')
    .eq('id', targetId)
    .maybeSingle();
  if (!comment) return {};
  const { data: post } = await admin
    .from('forum_posts')
    .select('topic')
    .eq('id', comment.post_id)
    .maybeSingle();
  return {
    preview: forumListPreviewText(comment.content, { maxLength: 120 }),
    forumUrl: `/forum/${comment.post_id}#comments`,
    storedTopic: post?.topic || null,
  };
}
