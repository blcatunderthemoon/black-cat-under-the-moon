/**
 * Server helpers for forum poll vote counts.
 */

import { isOptionalFeatureError } from './forum-stats.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} postId
 * @param {string | undefined} viewerId
 */
export async function getPollsForPost(admin, postId, viewerId) {
  const { data: polls, error } = await admin
    .from('forum_polls')
    .select('id, title, options, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isOptionalFeatureError(error)) return [];
    console.error('[forum/polls] fetch failed:', error.message);
    return [];
  }

  const rows = polls || [];
  if (!rows.length) return [];

  const pollIds = rows.map((p) => p.id);
  const { data: votes, error: votesError } = await admin
    .from('forum_poll_votes')
    .select('poll_id, option_index, user_id')
    .in('poll_id', pollIds);

  if (votesError && !isOptionalFeatureError(votesError)) {
    console.error('[forum/polls] votes fetch failed:', votesError.message);
  }

  const voteRows = votes || [];

  return rows.map((poll) => {
    const options = Array.isArray(poll.options) ? poll.options : [];
    const counts = options.map(() => 0);
    let viewerOptionIndex = null;

    for (const vote of voteRows) {
      if (vote.poll_id !== poll.id) continue;
      const idx = Number(vote.option_index);
      if (idx >= 0 && idx < counts.length) {
        counts[idx] += 1;
      }
      if (viewerId && vote.user_id === viewerId) {
        viewerOptionIndex = idx;
      }
    }

    const totalVotes = counts.reduce((sum, n) => sum + n, 0);

    return {
      id: poll.id,
      title: poll.title || '投票',
      options,
      counts,
      total_votes: totalVotes,
      viewer_option_index: viewerOptionIndex,
      has_voted: viewerOptionIndex !== null,
    };
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} postId
 * @param {Array<{ id: string, title: string, options: string[] }>} polls
 */
export async function insertPollsForPost(admin, postId, polls) {
  if (!polls?.length) return { ok: true };

  const rows = polls.map((poll) => ({
    id: poll.id,
    post_id: postId,
    title: poll.title,
    options: poll.options,
  }));

  const { error } = await admin.from('forum_polls').insert(rows);
  if (error) {
    if (error.code === '42P01') {
      return { ok: false, error: '投票功能尚未設定。' };
    }
    console.error('[forum/polls] insert failed:', error.message);
    return { ok: false, error: '建立投票失敗。' };
  }

  return { ok: true };
}
