/**
 * POST /api/gatherings/[id]/apply — RSVP / knock
 */

import { requireUser, sendAuthError, getAdminClient, ensureProfile } from '../../../../lib/server-auth.js';
import { filterContent } from '../../../../lib/content-filter.js';
import {
  loadGatheringActor,
  assertCanApply,
  assertNotBlockedWithHost,
  maybeMarkCompleted,
  toPublicGathering,
  syncGatheringApprovedCount,
} from '../../../../lib/gatherings.js';
import { notifyGatheringApplication, notifyGatheringDecision, notifyGatheringApplicationReceived } from '../../../../lib/gathering-notify.js';
import { databaseNowIso } from '../../../../lib/hong-kong-time.js';
import { parseGatheringContact } from '../../../../lib/gathering-contact.js';
import {
  createRateLimiter,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../../lib/rate-limit.js';

const applyLimiter = createRateLimiter('gathering-apply', 15, '1 h');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少聚會 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const limited = await rateLimitOrPass(applyLimiter, `gathering-apply:${user.id}`);
  if (!limited.ok) return rateLimitResponse(res, limited.reason);

  await ensureProfile(user);
  const admin = getAdminClient();
  const actor = await loadGatheringActor(admin, user.id);
  if (!actor.ok) return res.status(actor.status).json({ error: actor.error, code: actor.code });

  let row = (await admin.from('gatherings').select('*').eq('id', id).maybeSingle()).data;
  if (!row) return res.status(404).json({ error: '找不到此聚會。' });
  row = await maybeMarkCompleted(admin, row);

  const applyGate = assertCanApply(actor, row);
  if (!applyGate.ok) return res.status(applyGate.status).json({ error: applyGate.error, code: applyGate.code });

  const blockCheck = await assertNotBlockedWithHost(row.host_id, user.id);
  if (!blockCheck.ok) return res.status(blockCheck.status).json({ error: blockCheck.error, code: blockCheck.code });

  const contact = parseGatheringContact(req.body || {}, { phoneRequired: !row.is_online });
  if (!contact.ok) {
    return res.status(400).json({ error: contact.error, code: 'contact_required' });
  }

  let knockMessage = req.body?.knock_message == null ? null : String(req.body.knock_message).trim();
  if (row.require_knock_message && (!knockMessage || knockMessage.length < 1)) {
    return res.status(400).json({ error: '請回答敲門問題。', code: 'knock_required' });
  }
  if (knockMessage && knockMessage.length > 200) {
    return res.status(400).json({ error: '敲門回答最多 200 字。' });
  }
  if (knockMessage) {
    const filtered = filterContent(knockMessage);
    if (filtered.blocked) {
      if (filtered.crisis) return res.status(451).json({ error: 'crisis', crisis: true });
      return res.status(422).json({ error: '敲門回答包含不允許的詞語。' });
    }
  }

  const { data: existing } = await admin
    .from('gathering_attendees')
    .select('*')
    .eq('gathering_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'pending' || existing.status === 'approved') {
      return res.status(409).json({ error: '你已經申請或已獲邀。', code: 'already_applied' });
    }
    if (existing.status === 'rejected') {
      return res.status(409).json({ error: '此聚會申請已被婉拒，無法再申請。', code: 'rejected' });
    }
  }

  const autoApprove = row.approval_mode === 'auto' && row.status === 'open'
    && (row.approved_count || 0) < row.max_participants;

  const attendeePayload = {
    gathering_id: id,
    user_id: user.id,
    status: autoApprove ? 'approved' : 'pending',
    knock_message: knockMessage || null,
    contact_email: contact.email,
    contact_phone: contact.phone,
    reviewed_at: autoApprove ? databaseNowIso() : null,
    reviewed_by: autoApprove ? row.host_id : null,
    updated_at: databaseNowIso(),
  };

  let attendance;
  if (existing?.status === 'withdrawn') {
    const { data, error } = await admin
      .from('gathering_attendees')
      .update(attendeePayload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) {
      console.error('[gatherings/apply] update failed:', error.message);
      return res.status(500).json({ error: '申請失敗。' });
    }
    attendance = data;
  } else {
    const { data, error } = await admin
      .from('gathering_attendees')
      .insert(attendeePayload)
      .select('*')
      .single();
    if (error) {
      console.error('[gatherings/apply] insert failed:', error.message);
      return res.status(500).json({ error: '申請失敗。' });
    }
    attendance = data;
  }

  let hostNotified = false;
  let applicantNotified = false;

  // Host always gets Inbox notice when someone applies / auto-joins.
  try {
    hostNotified = await notifyGatheringApplication({
      hostId: row.host_id,
      gatheringId: id,
      gatheringTitle: row.title,
      startsAt: row.starts_at,
      applicantId: user.id,
      applicantName: actor.profile.display_name,
      knockMessage,
      autoApproved,
    });
  } catch (err) {
    console.error('[gatherings/apply] host notify failed:', err?.message || err);
  }

  // Applicant Inbox: pending ack, or approved if auto-approve.
  try {
    if (autoApprove) {
      applicantNotified = await notifyGatheringDecision({
        applicantId: user.id,
        gatheringId: id,
        gatheringTitle: row.title,
        approved: true,
      });
    } else {
      applicantNotified = await notifyGatheringApplicationReceived({
        applicantId: user.id,
        gatheringId: id,
        gatheringTitle: row.title,
        startsAt: row.starts_at,
      });
    }
  } catch (err) {
    console.error('[gatherings/apply] applicant notify failed:', err?.message || err);
  }

  if (attendance.status === 'approved') {
    await syncGatheringApprovedCount(admin, id);
  }

  const refreshed = (await admin.from('gatherings').select('*').eq('id', id).maybeSingle()).data || row;

  return res.status(200).json({
    attendance: {
      status: attendance.status,
      knock_message: attendance.knock_message,
    },
    gathering: toPublicGathering(refreshed, {
      myAttendance: attendance,
      includePrivate: attendance.status === 'approved',
    }),
    host_notified: hostNotified,
    applicant_notified: applicantNotified,
  });
}
