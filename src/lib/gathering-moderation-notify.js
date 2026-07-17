/**
 * Notify moderators when a gathering report threshold is reached (Inbox system message).
 * Mirrors forum-moderation-notify.js but routes through the Moonlight Gathering
 * system thread fallback (see gathering-notify.js).
 */

import { REPORT_MODERATOR_NOTIFY_THRESHOLD } from './moderation.js';
import { getAdminClient } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';
import { GATHERING_INBOX_SOURCE_ID } from './gathering-notify.js';

const ALERT_DEDUP_MS = 24 * 60 * 60 * 1000;

async function findOrCreateModeratorThread(admin, userId) {
  const { data: existing } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_id', GATHERING_INBOX_SOURCE_ID)
    .eq('participant_a', userId)
    .eq('participant_b', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from('inbox_threads')
    .insert({
      participant_a: userId,
      participant_b: userId,
      source_type: 'system',
      source_id: GATHERING_INBOX_SOURCE_ID,
      last_message_at: databaseNowIso(),
    })
    .select('id')
    .single();

  if (!error && created?.id) return created.id;

  // Fallback for older CHECK constraints (direct self-thread).
  const { data: fallback, error: fallbackErr } = await admin
    .from('inbox_threads')
    .insert({
      participant_a: userId,
      participant_b: userId,
      source_type: 'direct',
      source_id: GATHERING_INBOX_SOURCE_ID,
      last_message_at: databaseNowIso(),
    })
    .select('id')
    .single();

  if (fallbackErr) {
    console.error('[gathering-moderation-notify] thread create failed:', fallbackErr.message);
    return null;
  }
  return fallback.id;
}

async function insertModerationMessage(admin, row) {
  const attempts = [
    row,
    { ...row, message_type: 'user_letter' },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    const { error } = await admin.from('inbox_messages').insert(attempt);
    if (!error) return true;
    lastError = error;
  }
  console.error('[gathering-moderation-notify] message insert failed:', lastError?.message);
  return false;
}

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

  const content = `🛡️ 有${label}收到 ${reportCount} 次檢舉，待月光守護者處理。${title ? `「${String(title).slice(0, 40)}」` : ''}`;

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

  const now = databaseNowIso();
  let sent = false;

  for (const mod of moderators) {
    const threadId = await findOrCreateModeratorThread(admin, mod.id);
    if (!threadId) continue;

    const ok = await insertModerationMessage(admin, {
      thread_id: threadId,
      sender_id: null,
      recipient_id: mod.id,
      message_type: 'system',
      content,
      payload,
    });

    if (ok) {
      sent = true;
      await admin.from('inbox_threads').update({ last_message_at: now }).eq('id', threadId);
    }
  }

  return sent;
}
