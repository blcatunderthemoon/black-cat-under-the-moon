/**
 * Forum social Inbox notifications — likes, comments, replies.
 * Delivered via system channel `forum` (黑貓樹洞).
 */

import { getAdminClient } from './server-auth.js';
import { sendSystemInboxMessage } from './system-inbox.js';

function clip(text, max = 40) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function actorLabel(name) {
  const n = String(name || '').trim();
  return n || '一位旅人';
}

function forumUrl(postId, commentId) {
  if (!postId) return null;
  if (commentId) return `/forum/${postId}#comment-${commentId}`;
  return `/forum/${postId}`;
}

async function deliver(userId, content, payload) {
  if (!userId) return false;
  try {
    return await sendSystemInboxMessage({
      channel: 'forum',
      userId,
      content,
      payload,
    });
  } catch (err) {
    console.error('[forum-social-notify] deliver failed:', err?.message || err);
    return false;
  }
}

/**
 * Post author: someone liked their post.
 */
export async function notifyForumPostLiked({
  postId,
  postAuthorId,
  postTitle,
  actorId,
  actorName,
}) {
  if (!postId || !postAuthorId || !actorId || postAuthorId === actorId) return false;
  const name = actorLabel(actorName);
  const title = clip(postTitle);
  const content = title
    ? `${name} 對你的貼文「${title}」按讚了。`
    : `${name} 對你的貼文按讚了。`;

  return deliver(postAuthorId, content, {
    kind: 'forum_post_liked',
    post_id: postId,
    actor_id: actorId,
    actor_name: name,
    post_title: title || null,
    forum_url: forumUrl(postId),
  });
}

/**
 * Comment author: someone liked their comment.
 */
export async function notifyForumCommentLiked({
  postId,
  commentId,
  commentAuthorId,
  actorId,
  actorName,
}) {
  if (!postId || !commentId || !commentAuthorId || !actorId || commentAuthorId === actorId) {
    return false;
  }
  const name = actorLabel(actorName);
  const content = `${name} 對你的留言按讚了。`;

  return deliver(commentAuthorId, content, {
    kind: 'forum_comment_liked',
    post_id: postId,
    comment_id: commentId,
    actor_id: actorId,
    actor_name: name,
    forum_url: forumUrl(postId, commentId),
  });
}

/**
 * Post author and/or parent-comment author: new comment / reply.
 * Skips self; if reply author is also OP, only one notification is sent to that user.
 */
export async function notifyForumCommentCreated({
  postId,
  postAuthorId,
  postTitle,
  commentId,
  parentCommentId,
  parentAuthorId,
  actorId,
  actorName,
  preview,
}) {
  if (!postId || !commentId || !actorId) return false;

  const name = actorLabel(actorName);
  const title = clip(postTitle);
  const snippet = clip(preview, 48);
  const url = forumUrl(postId, commentId);
  const notified = new Set();

  const jobs = [];

  if (parentCommentId && parentAuthorId && parentAuthorId !== actorId) {
    const content = snippet
      ? `${name} 回覆了你的留言：「${snippet}」`
      : `${name} 回覆了你的留言。`;
    jobs.push(deliver(parentAuthorId, content, {
      kind: 'forum_comment_reply',
      post_id: postId,
      comment_id: commentId,
      parent_comment_id: parentCommentId,
      actor_id: actorId,
      actor_name: name,
      preview: snippet || null,
      forum_url: url,
    }));
    notified.add(parentAuthorId);
  }

  if (postAuthorId && postAuthorId !== actorId && !notified.has(postAuthorId)) {
    const content = title
      ? (snippet
        ? `${name} 回應了你的貼文「${title}」：「${snippet}」`
        : `${name} 回應了你的貼文「${title}」。`)
      : (snippet
        ? `${name} 回應了你的貼文：「${snippet}」`
        : `${name} 回應了你的貼文。`);
    jobs.push(deliver(postAuthorId, content, {
      kind: 'forum_post_commented',
      post_id: postId,
      comment_id: commentId,
      parent_comment_id: parentCommentId || null,
      actor_id: actorId,
      actor_name: name,
      post_title: title || null,
      preview: snippet || null,
      forum_url: url,
    }));
  }

  if (!jobs.length) return false;
  const results = await Promise.all(jobs);
  return results.some(Boolean);
}

/** Resolve actor display name (best-effort). */
export async function resolveForumNotifyActorName(admin = getAdminClient(), userId) {
  if (!userId) return null;
  const { data } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  return data?.display_name || null;
}
