/**
 * GET  /api/forum/welcome?topic=親密話題 — resolved welcome card
 * GET  /api/forum/welcome — all topic welcome cards
 * PATCH /api/forum/welcome — update welcome card (moderator+)
 * Body: { topic, title, content, mood_tag?, reset?: boolean }
 */

import { getAdminClient } from '../../../lib/server-auth.js';
import { FORUM_TOPICS } from '../../../lib/forum-categories.js';
import { resolveModerationActorForWelcomeTopic } from '../../../lib/forum-moderation-auth.js';
import {
  fetchWelcomePost,
  fetchAllWelcomePosts,
  upsertWelcomePost,
  deleteWelcomePost,
} from '../../../lib/forum-welcome-store.js';

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

function resolveTopicParam(queryTopic, bodyTopic) {
  const raw = typeof queryTopic === 'string' && queryTopic.trim()
    ? queryTopic.trim()
    : (typeof bodyTopic === 'string' ? bodyTopic.trim() : '');
  if (!raw || !FORUM_TOPICS.includes(raw) || raw === '全部') return null;
  return raw;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'PATCH') return handlePatch(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  const admin = getAdminClient();
  const topic = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';

  try {
    if (topic && FORUM_TOPICS.includes(topic) && topic !== '全部') {
      const welcome = await fetchWelcomePost(admin, topic);
      return res.status(200).json({ welcome });
    }

    const welcomes = await fetchAllWelcomePosts(admin);
    return res.status(200).json({ welcomes });
  } catch (err) {
    console.error('[forum/welcome] GET failed:', err?.message || err);
    return res.status(500).json({ error: '無法載入版規。' });
  }
}

async function handlePatch(req, res) {
  const body = parseBody(req);
  const topic = resolveTopicParam(req.query.topic, body.topic);
  if (!topic) {
    return res.status(400).json({ error: '請提供有效的版塊 topic。' });
  }

  const actor = await resolveModerationActorForWelcomeTopic(req, res, topic);
  if (!actor) return undefined;

  const admin = getAdminClient();

  if (body.reset === true) {
    const result = await deleteWelcomePost(admin, topic);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ success: true, welcome: result.welcome });
  }

  const result = await upsertWelcomePost(admin, topic, body, actor.actorId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ success: true, welcome: result.welcome });
}
