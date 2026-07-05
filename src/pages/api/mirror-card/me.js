/**
 * GET /api/mirror-card/me  — fetch own card
 * PATCH /api/mirror-card/me — update own card's visibility settings or basic fields
 *
 * For creating/updating a full card from Mirror Mode results,
 * pass the full mirror mode payload via PATCH.
 */

import { requireUser, ensureProfile, getAdminClient, sendAuthError } from '../../../lib/server-auth.js';
import { isAllowedProfilePhotoUrl } from '../../../lib/cloudinary-profile-upload.js';
import { databaseNowIso } from '../../../lib/hong-kong-time.js';

export default async function handler(req, res) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  await ensureProfile(user);
  const admin = getAdminClient();

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('mirror_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'Failed to load mirror card' });
    return res.status(200).json({ card: data || null });
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    // Allowed fields to update
    const allowed = [
      'mirror_type',
      'shadow_type',
      'mirror_scores',
      'basic_answers',
      'matching_summary',
      'visibility_settings',
      'card_image_url',
      'trait_scores',
      'scoring_version',
      'tension_narratives',
    ];

    const updates = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if ('card_image_url' in updates) {
      const url = updates.card_image_url;
      if (url != null && url !== '' && !isAllowedProfilePhotoUrl(url)) {
        return res.status(400).json({ error: 'Invalid card_image_url' });
      }
    }

    // Strip any sensitive fields from basic_answers before saving
    if (updates.basic_answers && typeof updates.basic_answers === 'object') {
      const { email, ig_username, tg_username, ...safeAnswers } = updates.basic_answers;
      updates.basic_answers = safeAnswers;
    }

    // Check if card exists
    const { data: existing } = await admin
      .from('mirror_cards')
      .select('id, public_slug, mirror_type')
      .eq('user_id', user.id)
      .maybeSingle();

    // Once a mirror result is saved it cannot be changed — only visibility/image updates
    const lockedFields = [
      'mirror_type',
      'shadow_type',
      'mirror_scores',
      'basic_answers',
      'matching_summary',
      'trait_scores',
      'scoring_version',
      'tension_narratives',
    ];
    if (existing?.mirror_type && lockedFields.some((k) => k in updates)) {
      return res.status(409).json({
        error: 'mirror_card_locked',
        message: 'Mirror card result cannot be changed once submitted.',
      });
    }

    if (existing) {
      const { data: updated, error: updateError } = await admin
        .from('mirror_cards')
        .update({ ...updates, updated_at: databaseNowIso() })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) return res.status(500).json({ error: 'Failed to update mirror card' });
      return res.status(200).json({ card: updated });
    }

    // Create new card
    const slug = generateSlug();
    const { data: created, error: createError } = await admin
      .from('mirror_cards')
      .insert({
        user_id: user.id,
        public_slug: slug,
        ...updates,
      })
      .select()
      .single();

    if (createError) {
      // Slug collision retry
      const slug2 = generateSlug();
      const { data: created2, error: createError2 } = await admin
        .from('mirror_cards')
        .insert({ user_id: user.id, public_slug: slug2, ...updates })
        .select()
        .single();
      if (createError2) return res.status(500).json({ error: 'Failed to create mirror card' });
      return res.status(201).json({ card: created2 });
    }

    return res.status(201).json({ card: created });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function generateSlug() {
  // moon-<6 random chars> — not UUID, not guessable but memorable
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = 'moon-';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
