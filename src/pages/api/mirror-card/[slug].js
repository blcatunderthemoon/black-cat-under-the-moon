/**
 * GET /api/mirror-card/[slug]
 * Public endpoint — returns mirror card data shaped to the viewer's permission level.
 *
 * Permission levels:
 *   detailed — owner, or premium viewer (not blocked)
 *   basic    — matched user (not blocked)
 *   public   — everyone else
 *
 * Pass Bearer token to get elevated permissions. Unauthenticated requests get public view.
 */

import { getOptionalUser, getAdminClient, getSubscriptionTier } from '../../../lib/server-auth.js';
import { getMirrorCardVisibility, getMirrorCardMessaging, shapeMirrorCard } from '../../../lib/permissions.js';
import { getMirrorCardPhotoExchange } from '../../../lib/photo-exchange.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  const admin = getAdminClient();

  // Load the card and resolve the viewer concurrently — they're independent.
  const [{ data: card, error }, viewer] = await Promise.all([
    admin
      .from('mirror_cards')
      .select('*')
      .eq('public_slug', slug)
      .maybeSingle(),
    getOptionalUser(req),
  ]);

  if (error || !card) {
    return res.status(404).json({ error: 'Mirror card not found' });
  }

  const viewerId = viewer?.id || null;

  if (card.is_published === false && card.user_id !== viewerId) {
    return res.status(404).json({ error: 'Mirror card not found' });
  }

  const canMessage = !!viewerId && viewerId !== card.user_id;

  // Visibility, owner profile, messaging and photo-exchange state are all
  // independent — fetch them in parallel instead of one-by-one.
  const [visibility, { data: profile }, messaging, photoExchange, viewerTier] = await Promise.all([
    getMirrorCardVisibility(viewerId, card.user_id),
    admin
      .from('profiles')
      .select('display_name, avatar_style, status, bio')
      .eq('id', card.user_id)
      .maybeSingle(),
    canMessage ? getMirrorCardMessaging(viewerId, card.user_id) : Promise.resolve(null),
    viewerId ? getMirrorCardPhotoExchange(viewerId, card.user_id) : Promise.resolve(null),
    viewerId ? getSubscriptionTier(viewerId) : Promise.resolve('free'),
  ]);

  if (visibility === 'none') {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!profile || profile.status === 'suspended' || profile.status === 'deleted') {
    return res.status(404).json({ error: 'Mirror card not found' });
  }

  // Shape the card to the allowed visibility
  const shaped = shapeMirrorCard(card, visibility);

  return res.status(200).json({
    card: shaped,
    owner: {
      display_name: profile.display_name,
      avatar_style: profile.avatar_style,
      bio: profile.bio?.trim() || null,
    },
    viewer_level: visibility,
    viewer_tier: viewerTier,
    is_owner: viewerId === card.user_id,
    premium_locked: visibility !== 'detailed' && !!viewerId && viewerId !== card.user_id,
    messaging,
    photo_exchange: photoExchange,
  });
}
