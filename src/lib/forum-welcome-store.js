/**
 * DB-backed welcome / 版規 cards (overrides forum-welcome.js defaults).
 */

import { FORUM_TOPICS } from './forum-categories.js';
import { getWelcomePost as getDefaultWelcomePost } from './forum-welcome.js';

export const WELCOME_MOOD_TAGS = ['官方', '版規', '指南'];
export const WELCOME_TITLE_MAX = 80;
export const WELCOME_CONTENT_MAX = 4000;

function isMissingWelcomeTable(error) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = String(error.message || '');
  return msg.includes('forum_welcome_posts')
    && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('Could not find'));
}

export function mergeWelcomePost(topic, override) {
  const defaults = getDefaultWelcomePost(topic);
  if (!override) {
    return { topic, ...defaults, is_custom: false, updated_at: null };
  }
  return {
    topic,
    title: override.title ?? defaults.title,
    content: override.content ?? defaults.content,
    mood_tag: override.mood_tag ?? defaults.mood_tag,
    updated_at: override.updated_at || null,
    is_custom: true,
  };
}

export function resolveWelcomePost(topic, overridesMap) {
  const override = overridesMap instanceof Map
    ? overridesMap.get(topic)
    : overridesMap?.[topic];
  return mergeWelcomePost(topic, override || null);
}

export async function fetchWelcomeOverridesMap(admin) {
  const { data, error } = await admin
    .from('forum_welcome_posts')
    .select('topic, title, content, mood_tag, updated_at, updated_by');

  if (isMissingWelcomeTable(error)) return new Map();
  if (error) throw error;

  return new Map((data || []).map((row) => [row.topic, row]));
}

export async function fetchWelcomePost(admin, topic) {
  const map = await fetchWelcomeOverridesMap(admin);
  return resolveWelcomePost(topic, map);
}

export async function fetchAllWelcomePosts(admin) {
  const map = await fetchWelcomeOverridesMap(admin);
  const welcomes = {};
  for (const topic of FORUM_TOPICS) {
    if (topic === '全部') continue;
    welcomes[topic] = resolveWelcomePost(topic, map);
  }
  return welcomes;
}

export function normalizeWelcomePayload(body) {
  const title = String(body?.title || '').trim().slice(0, WELCOME_TITLE_MAX);
  const content = String(body?.content || '').trim().slice(0, WELCOME_CONTENT_MAX);
  const moodTag = WELCOME_MOOD_TAGS.includes(body?.mood_tag) ? body.mood_tag : '官方';
  return { title, content, mood_tag: moodTag };
}

export async function upsertWelcomePost(admin, topic, payload, updatedBy) {
  const { title, content, mood_tag } = normalizeWelcomePayload(payload);
  if (!title) return { ok: false, status: 400, error: '請填寫標題。' };
  if (!content) return { ok: false, status: 400, error: '請填寫版規內容。' };

  const { data, error } = await admin
    .from('forum_welcome_posts')
    .upsert({
      topic,
      title,
      content,
      mood_tag,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    }, { onConflict: 'topic' })
    .select('topic, title, content, mood_tag, updated_at')
    .single();

  if (isMissingWelcomeTable(error)) {
    return {
      ok: false,
      status: 503,
      error: '版規功能尚未啟用，請聯絡管理員執行資料庫遷移。',
    };
  }
  if (error) {
    console.error('[forum-welcome] upsert failed:', error.message);
    return { ok: false, status: 500, error: '儲存版規失敗，請稍後再試。' };
  }

  return { ok: true, welcome: mergeWelcomePost(topic, data) };
}

export async function deleteWelcomePost(admin, topic) {
  const { error } = await admin
    .from('forum_welcome_posts')
    .delete()
    .eq('topic', topic);

  if (isMissingWelcomeTable(error)) {
    return {
      ok: false,
      status: 503,
      error: '版規功能尚未啟用，請聯絡管理員執行資料庫遷移。',
    };
  }
  if (error) {
    console.error('[forum-welcome] delete failed:', error.message);
    return { ok: false, status: 500, error: '還原版規失敗，請稍後再試。' };
  }

  return { ok: true, welcome: mergeWelcomePost(topic, null) };
}
