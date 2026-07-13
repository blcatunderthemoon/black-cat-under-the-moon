/**
 * GET /api/forum/banner — public forum homepage scrolling banner config.
 */

import { getServiceOrUserClient } from '../../../lib/server-auth.js';
import { serializePublicForumBanner } from '../../../lib/forum-banner.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  const admin = getServiceOrUserClient(req);
  const { data, error } = await admin
    .from('forum_banner')
    .select('active, messages, updated_at')
    .eq('id', 1)
    .maybeSingle();

  if (error?.code === '42P01') {
    return res.status(200).json({ active: false, messages: [] });
  }
  if (error) {
    console.error('[forum/banner] fetch failed:', error.message);
    return res.status(200).json({ active: false, messages: [] });
  }

  return res.status(200).json(serializePublicForumBanner(data));
}
