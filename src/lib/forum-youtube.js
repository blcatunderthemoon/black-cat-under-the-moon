/**
 * YouTube embed tokens for forum markdown: ::youtube[VIDEO_ID]
 */

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
export const YOUTUBE_TOKEN_RE = /::youtube\[([a-zA-Z0-9_-]{11})\]/g;
export const YOUTUBE_LINE_RE = /^::youtube\[([a-zA-Z0-9_-]{11})\]$/;

/**
 * @param {string} input URL or raw video id
 * @returns {string | null}
 */
export function extractYoutubeVideoId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && YOUTUBE_ID_RE.test(v)) return v;
      const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed) return embed[1];
      const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shorts) return shorts[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function buildYoutubeMarkdown(videoId) {
  const id = extractYoutubeVideoId(videoId);
  if (!id) return null;
  return `\n::youtube[${id}]\n`;
}

export function youtubeEmbedUrl(videoId) {
  if (!YOUTUBE_ID_RE.test(String(videoId || ''))) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
