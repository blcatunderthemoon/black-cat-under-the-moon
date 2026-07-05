/**
 * POST /api/forum/polls/[id]/vote
 * Body: { option_index: number }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';
import { isValidPollId } from '../../../../../lib/forum-poll.js';
import { isOptionalFeatureError } from '../../../../../lib/forum-stats.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: pollId } = req.query;
  if (!isValidPollId(pollId)) {
    return res.status(400).json({ error: 'Invalid poll ID' });
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const optionIndex = Number(body.option_index);
  if (!Number.isInteger(optionIndex) || optionIndex < 0) {
    return res.status(400).json({ error: 'option_index is required' });
  }

  const admin = getAdminClient();

  const { data: poll, error: pollError } = await admin
    .from('forum_polls')
    .select('id, post_id, options')
    .eq('id', pollId)
    .maybeSingle();

  if (pollError) {
    if (isOptionalFeatureError(pollError)) {
      return res.status(503).json({ error: '投票功能尚未設定。' });
    }
    return res.status(500).json({ error: '讀取投票失敗。' });
  }

  if (!poll) return res.status(404).json({ error: 'Poll not found' });

  const options = Array.isArray(poll.options) ? poll.options : [];
  if (optionIndex >= options.length) {
    return res.status(400).json({ error: '無效的選項。' });
  }

  const { data: post } = await admin
    .from('forum_posts')
    .select('visibility')
    .eq('id', poll.post_id)
    .maybeSingle();

  if (!post || post.visibility === 'hidden') {
    return res.status(404).json({ error: 'Post not found' });
  }

  const { data: existing } = await admin
    .from('forum_poll_votes')
    .select('id, option_index')
    .eq('poll_id', pollId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.id) {
    if (existing.option_index === optionIndex) {
      return res.status(200).json({ success: true, unchanged: true });
    }
    const { error: updateError } = await admin
      .from('forum_poll_votes')
      .update({ option_index: optionIndex })
      .eq('id', existing.id);
    if (updateError) {
      console.error('[forum/poll/vote] update failed:', updateError.message);
      return res.status(500).json({ error: '投票失敗。' });
    }
  } else {
    const { error: insertError } = await admin
      .from('forum_poll_votes')
      .insert({ poll_id: pollId, user_id: user.id, option_index: optionIndex });

    if (insertError) {
      if (insertError.code === '42P01') {
        return res.status(503).json({ error: '投票功能尚未設定。' });
      }
      if (insertError.code === '23505') {
        return res.status(409).json({ error: '你已投過票。' });
      }
      console.error('[forum/poll/vote] insert failed:', insertError.message);
      return res.status(500).json({ error: '投票失敗。' });
    }
  }

  const { data: votes, error: votesError } = await admin
    .from('forum_poll_votes')
    .select('option_index')
    .eq('poll_id', pollId);

  if (votesError) {
    return res.status(200).json({
      success: true,
      viewer_option_index: optionIndex,
      has_voted: true,
    });
  }

  const counts = options.map(() => 0);
  for (const vote of votes || []) {
    const idx = Number(vote.option_index);
    if (idx >= 0 && idx < counts.length) counts[idx] += 1;
  }

  return res.status(200).json({
    success: true,
    viewer_option_index: optionIndex,
    has_voted: true,
    counts,
    total_votes: counts.reduce((sum, n) => sum + n, 0),
  });
}
