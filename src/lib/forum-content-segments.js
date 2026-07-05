/**
 * Split forum markdown into renderable segments (spoilers, youtube, markdown).
 */

import { YOUTUBE_TOKEN_RE } from './forum-youtube.js';
import { POLL_TOKEN_RE } from './forum-poll.js';

const COMPOSITE_SPLIT_RE = /(\|\|[^|\n]+?\|\||::youtube\[[a-zA-Z0-9_-]{11}\]|::poll\[[0-9a-f-]{36}\])/gi;

/**
 * @param {string} content
 * @returns {Array<{ type: 'spoiler' | 'youtube' | 'poll' | 'md', text?: string, videoId?: string, pollId?: string }>}
 */
export function parseForumContentSegments(content) {
  const raw = String(content || '');
  if (!raw) return [];

  return raw.split(COMPOSITE_SPLIT_RE).filter((part) => part.length > 0).map((part) => {
    const spoiler = part.match(/^\|\|(.+)\|\|$/);
    if (spoiler) return { type: 'spoiler', text: spoiler[1] };

    const yt = part.match(/^::youtube\[([a-zA-Z0-9_-]{11})\]$/);
    if (yt) return { type: 'youtube', videoId: yt[1] };

    const poll = part.match(/^::poll\[([0-9a-f-]{36})\]$/i);
    if (poll) return { type: 'poll', pollId: poll[1] };

    return { type: 'md', text: part };
  });
}

export { YOUTUBE_TOKEN_RE, POLL_TOKEN_RE };
