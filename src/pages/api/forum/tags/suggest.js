/**
 * GET /api/forum/tags/suggest?q=lin&limit=8
 * Tag autocomplete for compose — case-insensitive match on canonical key + display label.
 */

import { getAdminClient } from '../../../../lib/server-auth.js';
import { suggestForumTags } from '../../../../lib/forum-tag-stats.js';
import { getPresetTagsForTopic } from '../../../../lib/forum-categories.js';
import { canonicalForumTagKey } from '../../../../lib/forum-tags.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 12);
  const topic = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';

  if (!q) {
    return res.status(200).json({ suggestions: [] });
  }

  const admin = getAdminClient();
  const prefix = canonicalForumTagKey(q);
  const presetMatches = (topic && topic !== '全部')
    ? getPresetTagsForTopic(topic).filter((p) => (
      p.tag.startsWith(prefix)
      || p.display_label.toLowerCase().includes(q.toLowerCase())
    ))
    : [];

  const suggestions = await suggestForumTags(admin, q, { limit, topic });
  const seen = new Set();
  const merged = [];

  for (const item of presetMatches) {
    if (seen.has(item.tag)) continue;
    seen.add(item.tag);
    merged.push({ ...item, count: 0, official: true });
  }
  for (const item of suggestions) {
    if (seen.has(item.tag)) continue;
    seen.add(item.tag);
    merged.push(item);
  }

  return res.status(200).json({ suggestions: merged.slice(0, limit) });
}
