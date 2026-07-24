/**
 * System Inbox delivery (Moonlight Gatherings, forum moderation, etc.).
 *
 * The DB blocks self-threads (`no_self_thread`) and `source_id` is a uuid column,
 * so system notices are delivered as a normal two-party thread between the
 * recipient and a per-channel internal "anchor" account, using
 * `source_type = 'system'`. The anchor's display name (e.g. 月光聚會 / 論壇守護)
 * is what the user sees as the sender.
 *
 * Optional `sourceId` scopes the thread (e.g. one Moonlight Gathering thread
 * per gathering UUID) so notices for different gatherings stay separate.
 */

import { getAdminClient, ensureProfile } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';

export const SYSTEM_CHANNELS = {
  gathering: {
    email: 'gathering-inbox@internal.blackcatunderthemoon.com',
    name: '月光聚會',
  },
  forum_moderation: {
    email: 'forum-guardian-inbox@internal.blackcatunderthemoon.com',
    name: '論壇守護',
  },
  forum: {
    email: 'forum-activity-inbox@internal.blackcatunderthemoon.com',
    name: '黑貓樹洞',
  },
};

const anchorIdCache = {};

/**
 * Find (or lazily create) the internal anchor account for a system channel.
 * @returns {Promise<string|null>} anchor user id
 */
export async function ensureSystemAnchorId(channel, admin = getAdminClient()) {
  const cfg = SYSTEM_CHANNELS[channel];
  if (!cfg) throw new Error(`Unknown system channel: ${channel}`);
  if (anchorIdCache[channel]) return anchorIdCache[channel];

  let anchorId = null;
  try {
    const { data: found } = await admin.rpc('dashboard_search_auth_users', {
      search_query: cfg.email,
      result_limit: 5,
    });
    const exact = (found || []).find(
      (row) => String(row.email || '').toLowerCase() === cfg.email,
    );
    anchorId = exact?.id || null;
  } catch (err) {
    console.error('[system-inbox] anchor lookup failed:', err?.message || err);
  }

  if (!anchorId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: cfg.email,
      email_confirm: true,
      user_metadata: { display_name: cfg.name },
    });
    if (error || !created?.user?.id) {
      console.error('[system-inbox] anchor create failed:', error?.message || error);
      return null;
    }
    anchorId = created.user.id;
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('id', anchorId)
    .maybeSingle();

  if (!profile) {
    try {
      await ensureProfile({ id: anchorId, email: cfg.email, user_metadata: { display_name: cfg.name } });
    } catch (err) {
      console.error('[system-inbox] anchor profile create failed:', err?.message || err);
    }
    // Force the exact channel name (ensureProfile may de-duplicate).
    await admin.from('profiles').update({ display_name: cfg.name }).eq('id', anchorId);
  } else if (profile.display_name !== cfg.name) {
    await admin.from('profiles').update({ display_name: cfg.name }).eq('id', anchorId);
  }

  anchorIdCache[channel] = anchorId;
  return anchorId;
}

function normalizeSourceId(sourceId) {
  if (sourceId == null || sourceId === '') return null;
  const id = String(sourceId);
  // source_id is uuid — reject non-uuid keys so we never fail the insert
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}

async function findOrCreateSystemThread(admin, userId, anchorId, sourceId = null) {
  const scopedId = normalizeSourceId(sourceId);

  const pairFilter = `and(participant_a.eq.${userId},participant_b.eq.${anchorId}),and(participant_a.eq.${anchorId},participant_b.eq.${userId})`;

  async function findExisting() {
    let query = admin
      .from('inbox_threads')
      .select('id')
      .eq('source_type', 'system')
      .or(pairFilter)
      .order('created_at', { ascending: true })
      .limit(1);
    query = scopedId ? query.eq('source_id', scopedId) : query.is('source_id', null);
    const { data } = await query.maybeSingle();
    return data?.id || null;
  }

  const existingId = await findExisting();
  if (existingId) return existingId;

  const { data: created, error } = await admin
    .from('inbox_threads')
    .insert({
      participant_a: userId,
      participant_b: anchorId,
      source_type: 'system',
      source_id: scopedId,
      last_message_at: databaseNowIso(),
    })
    .select('id')
    .single();

  if (!error && created?.id) return created.id;

  // Race / unique conflict — re-read before giving up (avoid dropped notices).
  const raced = await findExisting();
  if (raced) return raced;

  console.error('[system-inbox] thread create failed:', error?.message, error?.code);
  return null;
}

/**
 * Deliver a system notification to a user's inbox.
 * @param {{ channel: string, userId: string, content: string, payload?: object, sourceId?: string|null }} opts
 * @returns {Promise<boolean>} whether it was delivered
 */
export async function sendSystemInboxMessage({
  channel,
  userId,
  content,
  payload,
  sourceId,
} = {}) {
  if (!userId) return false;
  const admin = getAdminClient();

  const anchorId = await ensureSystemAnchorId(channel, admin);
  if (!anchorId) return false;

  // Omitted sourceId → gathering channel scopes by payload.gathering_id (per-gathering threads).
  // Explicit null keeps a shared channel thread (forum / legacy).
  const threadSourceId = sourceId !== undefined
    ? sourceId
    : (channel === 'gathering' ? (payload?.gathering_id || null) : null);

  const threadId = await findOrCreateSystemThread(admin, userId, anchorId, threadSourceId);
  if (!threadId) return false;

  const { error } = await admin.from('inbox_messages').insert({
    thread_id: threadId,
    sender_id: anchorId,
    recipient_id: userId,
    message_type: 'system',
    content,
    payload,
  });

  if (error) {
    console.error('[system-inbox] message insert failed:', error.message, error.code);
    return false;
  }

  await admin
    .from('inbox_threads')
    .update({ last_message_at: databaseNowIso() })
    .eq('id', threadId);

  return true;
}

/** True when an inbox thread is a system-notification thread. */
export function isSystemInboxThread(thread) {
  return thread?.source_type === 'system';
}
