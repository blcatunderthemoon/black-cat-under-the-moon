/**
 * Moonlight Gatherings — Inbox system notifications (Phase 1: 1:1 system threads).
 */

import { getAdminClient } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';
import { formatGatheringHkTime } from './gatherings.js';

const SOURCE_ID = 'gathering';

async function findOrCreateGatheringSystemThread(admin, userId) {
  const { data: existing } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'system')
    .eq('source_id', SOURCE_ID)
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
      source_id: SOURCE_ID,
      last_message_at: databaseNowIso(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[gathering-notify] thread create failed:', error.message);
    return null;
  }
  return created.id;
}

async function sendSystemMessage(admin, userId, content, payload) {
  const threadId = await findOrCreateGatheringSystemThread(admin, userId);
  if (!threadId) return false;

  const { error } = await admin.from('inbox_messages').insert({
    thread_id: threadId,
    sender_id: null,
    recipient_id: userId,
    message_type: 'system',
    content,
    payload,
  });

  if (error) {
    console.error('[gathering-notify] message insert failed:', error.message);
    return false;
  }

  await admin.from('inbox_threads').update({ last_message_at: databaseNowIso() }).eq('id', threadId);
  return true;
}

export async function notifyGatheringApplication({
  hostId,
  gatheringId,
  gatheringTitle,
  startsAt,
  applicantName,
  knockMessage,
}) {
  const admin = getAdminClient();
  const when = formatGatheringHkTime(startsAt);
  const knock = knockMessage ? `回答：「${String(knockMessage).slice(0, 80)}」` : '（冇留言）';
  const content = `🌙 有人申請加入你的聚會「${String(gatheringTitle).slice(0, 40)}」${when ? `（${when}）` : ''}。申請人：${applicantName || '匿名貓咪'}。${knock}`;
  return sendSystemMessage(admin, hostId, content, {
    kind: 'gathering_application',
    gathering_id: gatheringId,
    gathering_url: `/gatherings/${gatheringId}`,
  });
}

export async function notifyGatheringDecision({
  applicantId,
  gatheringId,
  gatheringTitle,
  approved,
}) {
  if (!applicantId) return false;
  const admin = getAdminClient();
  const title = String(gatheringTitle || '月光聚會').slice(0, 40);
  const content = approved
    ? `✅ 主辦人已批准你參加「${title}」。可到活動頁查看私密地點／連結。`
    : `🌙 主辦人婉拒了你參加「${title}」的申請。等候下一輪月光吧。`;
  return sendSystemMessage(admin, applicantId, content, {
    kind: approved ? 'gathering_approved' : 'gathering_rejected',
    gathering_id: gatheringId,
    gathering_url: `/gatherings/${gatheringId}`,
  });
}

export async function notifyGatheringCancelled({
  userIds,
  gatheringId,
  gatheringTitle,
  reason,
}) {
  const admin = getAdminClient();
  const reasonText = reason ? `原因：${String(reason).slice(0, 100)}` : '';
  const content = `❌ 聚會「${String(gatheringTitle).slice(0, 40)}」已取消。${reasonText}`;
  let any = false;
  for (const userId of userIds || []) {
    const ok = await sendSystemMessage(admin, userId, content, {
      kind: 'gathering_cancelled',
      gathering_id: gatheringId,
      gathering_url: `/gatherings/${gatheringId}`,
    });
    if (ok) any = true;
  }
  return any;
}
