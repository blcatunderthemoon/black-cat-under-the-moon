/**
 * GET  /api/me — current user's account state
 * PATCH /api/me — update profile fields (display_name, bio, avatar_style)
 * Requires Bearer token in Authorization header.
 */

import { requireUser, getProfile, ensureProfile, getSubscriptionTier, sendAuthError, getAdminClient, resolveSubscriptionTier } from '../../lib/server-auth.js';
import { filterContent } from '../../lib/content-filter.js';
import { validateDisplayName } from '../../lib/display-name-policy.js';
import { isDisplayNameTaken } from '../../lib/display-name-uniqueness.js';
import { getQuotaUsage } from '../../lib/permissions.js';
import { normalizeLetterPrefs } from '../../lib/letter-gameplay.js';
import { buildMoonJourneySummary } from '../../lib/moon-journey.js';
import { getForumRole, canModerateForum, canAdminForum } from '../../lib/forum-roles.js';
import { getModeratorTopicsForUser } from '../../lib/forum-moderator-assignments.js';
import { databaseNowIso } from '../../lib/hong-kong-time.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'PATCH') return handlePatch(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const profile = await getProfile(user.id);
  if (!profile) {
    // Profile was deleted or never created — tell the client to sign out
    return res.status(401).json({ error: 'no_profile', code: 'NO_PROFILE' });
  }

  const admin = getAdminClient();

  const [{ count: unreadCount }, { data: mirrorCard }, { data: claimedResponse }, { data: subscription }] = await Promise.all([
    admin.from('inbox_messages').select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id).is('read_at', null).eq('is_hidden', false),
    admin.from('mirror_cards').select('id, public_slug, mirror_type, updated_at')
      .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('responses').select('id, created_at')
      .eq('user_id', user.id).eq('claim_status', 'claimed')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('subscriptions')
      .select('status, current_period_end, provider')
      .eq('user_id', user.id)
      .in('status', ['active', 'manual', 'past_due'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const subscriptionTier = resolveSubscriptionTier(subscription);

  const [activeLetterQuota, photoExchangeQuota] = subscriptionTier === 'premium'
    ? await Promise.all([
      getQuotaUsage(user.id, 'active_letter_monthly', subscriptionTier),
      getQuotaUsage(user.id, 'photo_exchange_monthly', subscriptionTier),
    ])
    : [null, null];

  const moonJourney = buildMoonJourneySummary(profile);
  const forumRole = getForumRole(profile);
  let moderatorTopics = null;
  if (forumRole === 'moderator') {
    try {
      moderatorTopics = await getModeratorTopicsForUser(admin, user.id);
    } catch {
      moderatorTopics = [];
    }
  }

  return res.status(200).json({
    user: { id: user.id, email: user.email || null, email_verified: user.email_confirmed_at != null },
    profile: {
      display_name: profile.display_name,
      avatar_style: profile.avatar_style,
      bio: profile.bio,
      status: profile.status,
      subscription_tier: subscriptionTier,
      forum_role: forumRole,
      forum_moderator_topics: moderatorTopics,
      is_forum_staff: canModerateForum(forumRole),
      can_admin_forum: canAdminForum(forumRole),
      created_at: profile.created_at,
      exchange_photo_url: profile.exchange_photo_url || null,
      exchange_photo_updated_at: profile.exchange_photo_updated_at || null,
      notification_prefs: {
        email_on_match: profile.notification_prefs?.email_on_match !== false,
        email_on_letter: profile.notification_prefs?.email_on_letter !== false,
      },
      letter_prefs: normalizeLetterPrefs(profile.letter_prefs, subscriptionTier),
      forum_mature_acknowledged: !!profile.forum_mature_ack_at,
    },
    mirror_card: mirrorCard
      ? {
          public_slug: mirrorCard.public_slug,
          mirror_type: mirrorCard.mirror_type,
          updated_at: mirrorCard.updated_at,
        }
      : null,
    claimed_match_response: claimedResponse
      ? { response_id: claimedResponse.id, claimed_at: claimedResponse.created_at }
      : null,
    unread_inbox_count: unreadCount ?? 0,
    subscription: subscriptionTier === 'premium' && subscription
      ? {
          provider: subscription.provider || null,
          status: subscription.status,
          current_period_end: subscription.current_period_end || null,
        }
      : null,
    active_letter_quota: activeLetterQuota,
    photo_exchange_quota: photoExchangeQuota,
    moon_journey: moonJourney,
    // Header 🐾 badge — feed shares the check-in day, so no extra query needed.
    my_cat: {
      needs_feed_badge: !moonJourney.checked_in_today,
    },
  });
}

async function handlePatch(req, res) {
  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const profile = await getProfile(user.id);
  if (!profile) return res.status(401).json({ error: 'no_profile', code: 'NO_PROFILE' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const updates = {};

  if ('display_name' in body) {
    const validation = validateDisplayName(body.display_name, {
      previousName: profile.display_name,
    });
    if (!validation.ok) return res.status(422).json({ error: validation.error });
    if (validation.value !== String(profile.display_name || '').trim()) {
      const admin = getAdminClient();
      try {
        const taken = await isDisplayNameTaken(admin, validation.value, { excludeUserId: user.id });
        if (taken) {
          return res.status(422).json({ error: '此暱稱已被使用，請換一個名字。' });
        }
      } catch {
        return res.status(500).json({ error: '無法驗證暱稱，請稍後再試。' });
      }
    }
    updates.display_name = validation.value;
  }

  if ('bio' in body) {
    const bio = String(body.bio || '').trim().slice(0, 200);
    if (bio) {
      const { blocked } = filterContent(bio);
      if (blocked) return res.status(422).json({ error: '簡介包含不允許的詞語。' });
    }
    updates.bio = bio || null;
  }

  if ('avatar_style' in body) {
    updates.avatar_style = String(body.avatar_style || '').trim().slice(0, 50) || null;
  }

  if ('notification_prefs' in body && body.notification_prefs && typeof body.notification_prefs === 'object') {
    const prefs = body.notification_prefs;
    updates.notification_prefs = {
      email_on_match: prefs.email_on_match !== false,
      email_on_letter: prefs.email_on_letter !== false,
    };
  }

  if ('letter_prefs' in body && body.letter_prefs && typeof body.letter_prefs === 'object') {
    const tier = await getSubscriptionTier(user.id);
    const normalized = normalizeLetterPrefs(body.letter_prefs, tier);
    updates.letter_prefs = {
      stamp_id: normalized.stamp_id,
      note_color: normalized.note_color,
      note_font: normalized.note_font,
      sound_enabled: normalized.sound_enabled,
    };
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .update({ ...updates, updated_at: databaseNowIso() })
    .eq('id', user.id)
    .select('display_name, bio, avatar_style, status, subscription_tier')
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update profile' });

  if (updates.display_name) {
    admin
      .from('forum_posts')
      .update({ anonymous_name_snapshot: updates.display_name })
      .eq('author_id', user.id)
      .then(() => {})
      .catch((syncErr) => {
        console.error('[me] forum name sync failed:', syncErr?.message || syncErr);
      });

    admin.auth.admin
      .updateUserById(user.id, {
        user_metadata: { display_name: updates.display_name },
      })
      .catch((syncErr) => {
        console.error('[me] auth metadata name sync failed:', syncErr?.message || syncErr);
      });
  }

  return res.status(200).json({ profile: data });
}
