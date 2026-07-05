/**
 * Server-side forum @mention notifications.
 */

import { getAdminClient } from './server-auth.js';
import { parseMentionUserIds } from './forum-mentions.js';
import { notifyForumMention } from './notify.js';

/**
 * @param {{
 *   content: string,
 *   actorId: string,
 *   postId: string,
 *   commentId?: string | null,
 * }} params
 */
export async function dispatchForumMentions({ content, actorId, postId, commentId = null }) {
  const recipientIds = parseMentionUserIds(content).filter((id) => id !== actorId);
  if (!recipientIds.length) return;

  const admin = getAdminClient();
  const { data: actorProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', actorId)
    .maybeSingle();

  const actorName = actorProfile?.display_name || '某位貓咪';

  await Promise.all(recipientIds.map(async (recipientId) => {
    try {
      await admin.from('forum_mention_notifications').insert({
        recipient_id: recipientId,
        actor_id: actorId,
        post_id: postId,
        comment_id: commentId,
      });
    } catch (err) {
      console.error('[forum-mention] insert failed:', err?.message || err);
    }
    notifyForumMention(recipientId, {
      actorName,
      postId,
      commentId,
    }).catch(() => {});
  }));
}
