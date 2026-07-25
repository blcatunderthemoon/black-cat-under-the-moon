import { NodeViewWrapper } from '@tiptap/react';
import { UiTvIcon } from './UiIcons.js';

export default function ForumYoutubeTiptapView({ node, deleteNode }) {
  const videoId = node.attrs.videoId;
  const thumb = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null;

  return (
    <NodeViewWrapper className="forum-youtube-tiptap" contentEditable={false}>
      <div className="forum-youtube-tiptap__card">
        <div className="forum-youtube-tiptap__thumb" aria-hidden="true">
          {thumb && <img src={thumb} alt="" />}
          <span className="forum-youtube-tiptap__play">▶</span>
        </div>
        <div className="forum-youtube-tiptap__body">
          <span className="forum-youtube-tiptap__label"><span aria-hidden="true"><UiTvIcon size={14} /></span> YouTube 影片</span>
          {videoId && (
            <span className="forum-youtube-tiptap__id">{videoId}</span>
          )}
        </div>
        <button
          type="button"
          className="forum-youtube-tiptap__remove"
          onClick={() => deleteNode()}
          title="移除影片"
          aria-label="移除影片"
        >
          ✕
        </button>
      </div>
    </NodeViewWrapper>
  );
}
