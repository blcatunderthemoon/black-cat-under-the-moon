/**
 * Server helpers for forum post tags.
 */

import { canonicalForumTagKey } from './forum-tags.js';
import { getTopicDbValues } from './forum-categories.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string[]} tagKeys
 * @returns {Promise<Record<string, string>>}
 */
export async function getTagLabelMap(admin, tagKeys) {
  const keys = [...new Set((tagKeys || []).map((k) => canonicalForumTagKey(k)).filter(Boolean))];
  const map = {};
  if (!keys.length) return map;

  const { data, error } = await admin
    .from('forum_tag_labels')
    .select('tag_key, display_label')
    .in('tag_key', keys);

  if (error) {
    if (error.code === '42P01') return map;
    console.error('[forum/tags] label map failed:', error.message);
    return map;
  }

  for (const row of data || []) {
    map[row.tag_key] = row.display_label;
  }
  return map;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {Record<string, string>} displayByKey
 */
export async function upsertTagLabels(admin, displayByKey) {
  const entries = Object.entries(displayByKey || {}).filter(([key, label]) => key && label);
  if (!entries.length) return { ok: true };

  const rows = entries.map(([key, label]) => ({
    tag_key: canonicalForumTagKey(key),
    display_label: normalizeDisplayLabel(label, key),
  }));

  const { error } = await admin
    .from('forum_tag_labels')
    .upsert(rows, { onConflict: 'tag_key', ignoreDuplicates: true });

  if (error) {
    if (error.code === '42P01') {
      return { ok: false, error: '標籤功能尚未設定完成，請聯絡管理員。' };
    }
    console.error('[forum/tags] label upsert failed:', error.message);
    return { ok: false, error: '儲存標籤顯示名稱失敗。' };
  }

  return { ok: true };
}

/**
 * @param {string} label
 * @param {string} key
 */
function normalizeDisplayLabel(label, key) {
  const value = String(label || '').trim();
  return value || canonicalForumTagKey(key);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string[]} postIds
 * @returns {Promise<Record<string, string[]>>}
 */
export async function getTagsByPostIds(admin, postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  const map = {};
  if (!ids.length) return map;

  const { data, error } = await admin
    .from('forum_post_tags')
    .select('post_id, tag')
    .in('post_id', ids)
    .order('tag', { ascending: true });

  if (error) {
    if (error.code === '42P01') return map;
    console.error('[forum/tags] fetch failed:', error.message);
    return map;
  }

  for (const row of data || []) {
    if (!map[row.post_id]) map[row.post_id] = [];
    map[row.post_id].push(row.tag);
  }
  return map;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} postId
 * @param {string[]} tags
 * @param {Record<string, string>} [displayByKey]
 */
export async function insertTagsForPost(admin, postId, tags, displayByKey = {}) {
  if (!tags?.length) return { ok: true };

  const labelResult = await upsertTagLabels(admin, displayByKey);
  if (!labelResult.ok) return labelResult;

  const rows = tags.map((tag) => ({ post_id: postId, tag: canonicalForumTagKey(tag) }));
  const { error } = await admin.from('forum_post_tags').insert(rows);

  if (error) {
    if (error.code === '42P01') {
      return { ok: false, error: '標籤功能尚未設定完成，請聯絡管理員。' };
    }
    console.error('[forum/tags] insert failed:', error.message);
    return { ok: false, error: '儲存標籤失敗。' };
  }

  return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string[]} tagKeys
 * @returns {Promise<Record<string, number>>}
 */
async function getTagUsageCounts(admin, tagKeys) {
  const keys = [...new Set((tagKeys || []).map((k) => canonicalForumTagKey(k)).filter(Boolean))];
  const counts = {};
  if (!keys.length) return counts;

  const { data, error } = await admin
    .from('forum_post_tags')
    .select('tag')
    .in('tag', keys);

  if (error) {
    if (error.code === '42P01') return counts;
    console.error('[forum/tags] count failed:', error.message);
    return counts;
  }

  for (const row of data || []) {
    counts[row.tag] = (counts[row.tag] || 0) + 1;
  }
  return counts;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ topic?: string | null, visibilityFilter: string[], limit?: number }} opts
 * @returns {Promise<Array<{ tag: string, display_label: string, count: number }>>}
 */
export async function getHotForumTags(admin, { topic = null, visibilityFilter, limit = 16 }) {
  let postQuery = admin
    .from('forum_posts')
    .select('id')
    .in('visibility', visibilityFilter)
    .order('created_at', { ascending: false })
    .limit(400);

  if (topic) {
    const dbTopics = getTopicDbValues(topic);
    if (dbTopics?.length) {
      postQuery = postQuery.in('topic', dbTopics);
    }
  }

  const { data: posts, error: postsError } = await postQuery;
  if (postsError) {
    if (postsError.code === '42P01') return [];
    console.error('[forum/tags] hot posts failed:', postsError.message);
    return [];
  }

  const postIds = (posts || []).map((p) => p.id);
  if (!postIds.length) return [];

  const { data: tagRows, error: tagError } = await admin
    .from('forum_post_tags')
    .select('tag')
    .in('post_id', postIds);

  if (tagError) {
    if (tagError.code === '42P01') return [];
    console.error('[forum/tags] hot tags failed:', tagError.message);
    return [];
  }

  const counts = new Map();
  for (const row of tagRows || []) {
    const tag = canonicalForumTagKey(row.tag);
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }

  const hot = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);

  const labelMap = await getTagLabelMap(admin, hot.map((h) => h.tag));

  return hot.map(({ tag, count }) => ({
    tag,
    display_label: labelMap[tag] || tag,
    count,
  }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} tag
 * @param {string[]} visibilityFilter
 * @returns {Promise<string[]>}
 */
export async function getPostIdsForTag(admin, tag, visibilityFilter) {
  const value = canonicalForumTagKey(tag);
  if (!value) return [];

  const { data: tagRows, error: tagError } = await admin
    .from('forum_post_tags')
    .select('post_id')
    .eq('tag', value);

  if (tagError) {
    if (tagError.code === '42P01') return [];
    console.error('[forum/tags] filter failed:', tagError.message);
    return [];
  }

  const candidateIds = [...new Set((tagRows || []).map((r) => r.post_id).filter(Boolean))];
  if (!candidateIds.length) return [];

  const { data: posts, error: postsError } = await admin
    .from('forum_posts')
    .select('id')
    .in('id', candidateIds)
    .in('visibility', visibilityFilter);

  if (postsError) {
    console.error('[forum/tags] visibility filter failed:', postsError.message);
    return [];
  }

  return (posts || []).map((p) => p.id);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ tag: string, display_label: string, count: number }>>}
 */
export async function suggestForumTags(admin, query, { limit = 8 } = {}) {
  const prefix = canonicalForumTagKey(query);
  if (!prefix) return [];

  const pattern = `${prefix}%`;
  const { data: labelRows, error } = await admin
    .from('forum_tag_labels')
    .select('tag_key, display_label')
    .or(`tag_key.ilike.${pattern},display_label.ilike.${pattern}`)
    .order('tag_key', { ascending: true })
    .limit(Math.min(limit * 3, 24));

  if (error) {
    if (error.code === '42P01') return [];
    console.error('[forum/tags] suggest failed:', error.message);
    return [];
  }

  const keys = (labelRows || []).map((row) => row.tag_key);
  const counts = await getTagUsageCounts(admin, keys);

  return (labelRows || [])
    .map((row) => ({
      tag: row.tag_key,
      display_label: row.display_label,
      count: counts[row.tag_key] || 0,
    }))
    .sort((a, b) => b.count - a.count || a.display_label.localeCompare(b.display_label))
    .slice(0, limit);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {Record<string, string[]>} tagsByPostId
 * @returns {Promise<Record<string, string>>}
 */
export async function getTagLabelMapForPosts(admin, tagsByPostId) {
  const keys = [];
  for (const tags of Object.values(tagsByPostId || {})) {
    for (const tag of tags || []) keys.push(tag);
  }
  return getTagLabelMap(admin, keys);
}
