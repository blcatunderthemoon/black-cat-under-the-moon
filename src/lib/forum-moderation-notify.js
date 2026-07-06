/**
 * Notify forum moderators when report threshold is reached (Inbox system message).
 */

import { REPORT_MODERATOR_NOTIFY_THRESHOLD } from './moderation.js';
import { getAdminClient } from './server-auth.js';
import { forumListPreviewText } from './forum-list-preview.js';
import { databaseNowIso } from './hong-kong-time.js';

const ALERT_DEDUP_MS = 24 * 60 * 60 * 1000;

async function findOrCreateSystemThread(admin, userId) {
  const sourceId = 'forum_moderation';
  const { data: existing } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'system')
    .eq('source_id', sourceId)
    .eq('participant_a', userId)
    .eq('participant_b', userId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from('inbox_threads')
    .insert({
      participant_a: userId,
      participant_b: userId,
      source_type: 'system',
      source_id: sourceId,
      last_message_at: databaseNowIso(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[forum-moderation-notify] thread create failed:', error.message);
    return null;
  }
  return created.id;
}

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
}) {
  if ((reportCount || 0) < REPORT_MODERATOR_NOTIFY_THRESHOLD) return false;

  const admin = getAdminClient();

  if (await wasAlertSentRecently(admin, targetType, targetId)) {
    return false;
  }

  const { data: moderators } = await admin
    .from('profiles')
    .select('id')
    .in('forum_role', ['moderator', 'admin'])
    .eq('status', 'active');

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

  const now = databaseNowIso();
  let sent = false;

  for (const mod of moderators) {
    const threadId = await findOrCreateSystemThread(admin, mod.id);
    if (!threadId) continue;

    const { error } = await admin.from('inbox_messages').insert({
      thread_id: threadId,
      sender_id: null,
      recipient_id: mod.id,
      message_type: 'system',
      content,
      payload,
    });

    if (!error) {
      sent = true;
      await admin.from('inbox_threads').update({ last_message_at: now }).eq('id', threadId);
    } else {
      console.error('[forum-moderation-notify] message insert failed:', error.message);
    }
  }

  return sent;
}

export async function buildReportNotifyContext(admin, targetType, targetId) {
  if (targetType === 'post') {
    const { data: post } = await admin
      .from('forum_posts')
      .select('id, title, content')
      .eq('id', targetId)
      .maybeSingle();
    if (!post) return {};
    return {
      postTitle: post.title,
      preview: forumListPreviewText(post.content, { maxLength: 120 }),
      forumUrl: `/forum/${post.id}`,
    };
  }

  const { data: comment } = await admin
    .from('forum_comments')
    .select('id, content, post_id')
    .eq('id', targetId)
    .maybeSingle();
  if (!comment) return {};
  return {
    preview: forumListPreviewText(comment.content, { maxLength: 120 }),
    forumUrl: `/forum/${comment.post_id}#comments`,
  };
}
