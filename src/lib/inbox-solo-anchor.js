/**
 * Internal anchor account for solo match inbox threads.
 * DB disallows participant_a = participant_b and non-uuid source_id values,
 * so one-sided matches use registered user + anchor instead of self-threads.
 */

import { ensureProfile, getAdminClient } from './server-auth.js';

const SOLO_ANCHOR_EMAIL = 'solo-match-anchor@internal.blackcatunderthemoon.com';
export const SOLO_MATCH_ANCHOR_DISPLAY_NAME = '月影連線';

let cachedAnchorId = null;

export function isSoloMatchPayload(payload) {
  return payload?.solo_partner === true;
}

export function isLegacySoloMatchThread(thread) {
  return thread?.source_type === 'match'
    && thread.participant_a === thread.participant_b
    && String(thread.source_id || '').startsWith('solo:');
}

export function soloPartnerResponseId(payload, myResponseIds = []) {
  if (!isSoloMatchPayload(payload)) return null;
  const rA = Number(payload.response_a_id);
  const rB = Number(payload.response_b_id);
  if (!rA || !rB) return null;
  const myIds = new Set((myResponseIds || []).map(Number));
  if (myIds.has(rA)) return rB;
  if (myIds.has(rB)) return rA;
  return rB;
}

export async function ensureSoloMatchAnchorUserId(admin = getAdminClient()) {
  if (cachedAnchorId) return cachedAnchorId;

  const { data: found, error: searchError } = await admin.rpc('dashboard_search_auth_users', {
    search_query: SOLO_ANCHOR_EMAIL,
    result_limit: 5,
  });
  if (searchError) throw searchError;

  const exact = (found || []).find(
    (row) => String(row.email || '').toLowerCase() === SOLO_ANCHOR_EMAIL,
  );

  let anchorId = exact?.id || null;
  if (!anchorId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: SOLO_ANCHOR_EMAIL,
      email_confirm: true,
      user_metadata: { display_name: SOLO_MATCH_ANCHOR_DISPLAY_NAME },
    });
    if (createError) throw createError;
    anchorId = created.user.id;
  }

  const { data: existingProfile } = await admin.from('profiles').select('id').eq('id', anchorId).maybeSingle();
  if (!existingProfile) {
    await ensureProfile({ id: anchorId, email: SOLO_ANCHOR_EMAIL, user_metadata: { display_name: SOLO_MATCH_ANCHOR_DISPLAY_NAME } });
  }

  cachedAnchorId = anchorId;
  return anchorId;
}

export async function findSoloMatchThread(admin, registeredId, anchorId, soloKey) {
  const { data: threads } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'match')
    .or(
      `and(participant_a.eq.${registeredId},participant_b.eq.${anchorId}),and(participant_a.eq.${anchorId},participant_b.eq.${registeredId})`,
    );

  if (!threads?.length) return null;

  const threadIds = threads.map((thread) => thread.id);
  const { data: cards } = await admin
    .from('inbox_messages')
    .select('thread_id')
    .in('thread_id', threadIds)
    .eq('message_type', 'match_card')
    .eq('payload->>solo_match_key', soloKey)
    .limit(1);

  return cards?.[0]?.thread_id || null;
}

export function orderedParticipants(userAId, userBId) {
  return String(userAId) < String(userBId) ? [userAId, userBId] : [userBId, userAId];
}
