/**
 * Notify moderators when a gathering report threshold is reached (Inbox system message).
 * Mirrors forum-moderation-notify.js but routes through the Moonlight Gathering
 * system thread fallback (see gathering-notify.js).
 */

import { REPORT_MODERATOR_NOTIFY_THRESHOLD } from './moderation.js';
import { getAdminClient } from './server-auth.js';
import { sendSystemInboxMessage } from './system-inbox.js';

const ALERT_DEDUP_MS = 24 * 60 * 60 * 1000;

async function wasAlertSentRecently(admin, targetType, targetId) {
  const since = new Date(Date.now() - ALERT_DEDUP_MS).toISOString();
  const { data } = await admin
    .from('inbox_messages')
    .gte('created_at', since)
    .select('id')
    .filter('payload->>kind', 'eq', 'gathering_moderation_alert')
    .filter('payload->>target_type', 'eq', targetType)
    .filter('payload->>target_id', 'eq', String(targetId))
    .limit(1);
  return (data || []).length > 0;
}

/**
 * @returns {Promise<boolean>} whether any alert was sent
 */
export async function notifyGatheringModerators({
  targetType,
  targetId,
  gatheringId,
  reportCount,
  title,
  preview,
}) {
  if ((reportCount || 0) < REPORT_MODERATOR_NOTIFY_THRESHOLD) return false;

  const admin = getAdminClient();

  if (await wasAlertSentRecently(admin, targetType, targetId)) return false;

  const { data: moderators } = await admin
    .from('profiles')
    .select('id')
    .in('forum_role', ['moderator', 'admin'])
    .eq('status', 'active');

  if (!moderators?.length) return false;

  const label = targetType === 'gathering'
    ? '聚會'
    : targetType === 'comment'
      ? '聚會留言'
      : '參加者';

  const content = `有${label}收到 ${reportCount} 次檢舉，待月光守護者處理。${title ? `「${String(title).slice(0, 40)}」` : ''}`;

  const payload = {
    kind: 'gathering_moderation_alert',
    target_type: targetType,
    target_id: String(targetId),
    gathering_id: gatheringId || null,
    report_count: reportCount,
    title: title || null,
    preview: preview || null,
    gathering_url: gatheringId ? `/gatherings/${gatheringId}` : null,
  };

  let sent = false;

  for (const mod of moderators) {
    const ok = await sendSystemInboxMessage({
      channel: 'gathering',
      userId: mod.id,
      content,
      payload,
      sourceId: gatheringId || null,
    });
    if (ok) sent = true;
  }

  return sent;
}
