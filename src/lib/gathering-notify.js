/**
 * Moonlight Gatherings — Inbox system notifications (Phase 1: 1:1 system threads).
 */

import { getAdminClient } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';
import { formatGatheringHkTime } from './gatherings.js';

const SOURCE_ID = 'gathering';

async function findOrCreateGatheringSystemThread(admin, userId) {
  const { data: existing, error: findErr } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'system')
    .eq('source_id', SOURCE_ID)
    .eq('participant_a', userId)
    .eq('participant_b', userId)
    .limit(1)
    .maybeSingle();

  if (findErr) {
    console.error('[gathering-notify] thread find failed:', findErr.message, findErr.code);
  }
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
    console.error(
      '[gathering-notify] thread create failed:',
      error.message,
      error.code,
      error.details,
      '— run migration 20260716005000_inbox_system_messages_fix.sql',
    );
    return null;
  }
  return created.id;
}

async function insertInboxMessage(admin, row) {
  const { error } = await admin.from('inbox_messages').insert(row);
  if (!error) return { ok: true };

  // sender_id NULL may be rejected before migration; retry without the column.
  if (row.sender_id === null && /sender_id|null/i.test(String(error.message || ''))) {
    const { sender_id: _omit, ...rest } = row;
    const retry = await admin.from('inbox_messages').insert(rest);
    if (!retry.error) return { ok: true };
    console.error('[gathering-notify] message insert retry failed:', retry.error.message, retry.error.code);
    return { ok: false, error: retry.error };
  }

  console.error('[gathering-notify] message insert failed:', error.message, error.code, error.details);
  return { ok: false, error };
}

async function sendSystemMessage(admin, userId, content, payload) {
  if (!userId) return false;
  const threadId = await findOrCreateGatheringSystemThread(admin, userId);
  if (!threadId) return false;

  const result = await insertInboxMessage(admin, {
    thread_id: threadId,
    sender_id: null,
    recipient_id: userId,
    message_type: 'system',
    content,
    payload,
  });

  if (!result.ok) return false;

  await admin.from('inbox_threads').update({ last_message_at: databaseNowIso() }).eq('id', threadId);
  return true;
}

async function hasGatheringSystemMessage(admin, userId, { kind, gatheringId, applicantId }) {
  let query = admin
    .from('inbox_messages')
    .select('id')
    .eq('recipient_id', userId)
    .eq('message_type', 'system')
    .filter('payload->>kind', 'eq', kind)
    .filter('payload->>gathering_id', 'eq', String(gatheringId))
    .limit(1);

  if (applicantId) {
    query = query.filter('payload->>applicant_id', 'eq', String(applicantId));
  }

  const { data, error } = await query;
  if (error) {
    console.error('[gathering-notify] dedupe check failed:', error.message);
    return false;
  }
  return (data || []).length > 0;
}

/** Host: someone applied / auto-joined */
export async function notifyGatheringApplication({
  hostId,
  gatheringId,
  gatheringTitle,
  startsAt,
  applicantId,
  applicantName,
  knockMessage,
  autoApproved = false,
}) {
  if (!hostId) return false;
  const admin = getAdminClient();
  const when = formatGatheringHkTime(startsAt);
  const knock = knockMessage ? `回答：「${String(knockMessage).slice(0, 80)}」` : '（冇留言）';
  const title = String(gatheringTitle || '月光聚會').slice(0, 40);
  const name = applicantName || '匿名貓咪';
  const content = autoApproved
    ? `🌙 ${name} 已加入你的聚會「${title}」${when ? `（${when}）` : ''}（自動批准）。${knock}`
    : `🌙 有人申請加入你的聚會「${title}」${when ? `（${when}）` : ''}。申請人：${name}。${knock}`;

  return sendSystemMessage(admin, hostId, content, {
    kind: autoApproved ? 'gathering_joined' : 'gathering_application',
    gathering_id: gatheringId,
    applicant_id: applicantId || null,
    gathering_url: `/gatherings/${gatheringId}`,
  });
}

/** Applicant: application received (pending review) */
export async function notifyGatheringApplicationReceived({
  applicantId,
  gatheringId,
  gatheringTitle,
  startsAt,
}) {
  if (!applicantId) return false;
  const admin = getAdminClient();
  if (await hasGatheringSystemMessage(admin, applicantId, {
    kind: 'gathering_applied',
    gatheringId,
  })) {
    return false;
  }
  const when = formatGatheringHkTime(startsAt);
  const title = String(gatheringTitle || '月光聚會').slice(0, 40);
  const content = `🌙 你已申請「${title}」${when ? `（${when}）` : ''}。等候主辦人審核，結果會喺呢度通知你。`;
  return sendSystemMessage(admin, applicantId, content, {
    kind: 'gathering_applied',
    gathering_id: gatheringId,
    gathering_url: `/gatherings/${gatheringId}`,
  });
}

/** Applicant: approved or rejected */
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

/**
 * If approval/rejection notice never landed, send it once.
 */
export async function ensureGatheringDecisionNotified({
  applicantId,
  gatheringId,
  gatheringTitle,
  approved,
}) {
  if (!applicantId || !gatheringId || approved == null) return false;
  const admin = getAdminClient();
  const kind = approved ? 'gathering_approved' : 'gathering_rejected';
  if (await hasGatheringSystemMessage(admin, applicantId, { kind, gatheringId })) {
    return true; // already in Inbox
  }
  return notifyGatheringDecision({
    applicantId,
    gatheringId,
    gatheringTitle,
    approved,
  });
}

/**
 * Backfill host Inbox when a pending application never produced a system notice.
 */
export async function ensureGatheringApplicationNotified({
  hostId,
  gatheringId,
  gatheringTitle,
  startsAt,
  applicantId,
  applicantName,
  knockMessage,
}) {
  if (!hostId || !gatheringId || !applicantId) return false;
  const admin = getAdminClient();
  const already = await hasGatheringSystemMessage(admin, hostId, {
    kind: 'gathering_application',
    gatheringId,
    applicantId,
  });
  if (already) return false;
  const joined = await hasGatheringSystemMessage(admin, hostId, {
    kind: 'gathering_joined',
    gatheringId,
    applicantId,
  });
  if (joined) return false;

  return notifyGatheringApplication({
    hostId,
    gatheringId,
    gatheringTitle,
    startsAt,
    applicantId,
    applicantName,
    knockMessage,
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
