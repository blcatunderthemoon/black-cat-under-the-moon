import { youtubeEmbedUrl } from '../lib/forum-youtube.js';

export default function ForumYoutubeEmbed({ videoId, className = '' }) {
  const src = youtubeEmbedUrl(videoId);
  if (!src) return null;

  return (
    <div className={`forum-youtube-embed ${className}`.trim()}>
      <iframe
        src={src}
        title="YouTube 影片"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
