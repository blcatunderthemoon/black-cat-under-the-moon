import { NodeViewWrapper } from '@tiptap/react';
import { UiChartIcon } from './UiIcons.js';

export default function ForumPollTiptapView({ node, deleteNode, extension }) {
  const pollId = node.attrs.pollId;
  const meta = extension.options.getPollMeta?.(pollId);
  const title = meta?.title || '投票';
  const options = meta?.options || [];

  return (
    <NodeViewWrapper className="forum-poll-tiptap" contentEditable={false}>
      <div className="forum-poll-tiptap__card">
        <div className="forum-poll-tiptap__head">
          <span className="forum-poll-tiptap__icon" aria-hidden="true"><UiChartIcon size={16} /></span>
          <span className="forum-poll-tiptap__title">{title}</span>
          <button
            type="button"
            className="forum-poll-tiptap__remove"
            onClick={() => {
              extension.options.onRemovePoll?.(pollId);
              deleteNode();
            }}
            title="移除投票"
            aria-label="移除投票"
          >
            ✕
          </button>
        </div>
        {options.length > 0 ? (
          <ul className="forum-poll-tiptap__options">
            {options.map((label) => (
              <li key={label} className="forum-poll-tiptap__option">
                <span className="forum-poll-tiptap__radio" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="forum-poll-tiptap__hint">投票預覽</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}
