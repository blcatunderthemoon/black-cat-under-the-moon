import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ForumPollTiptapView from '../components/ForumPollTiptapView.js';

export const ForumPollNode = Node.create({
  name: 'forumPoll',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      getPollMeta: () => null,
      onRemovePoll: () => {},
    };
  },

  addAttributes() {
    return {
      pollId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-forum-poll'),
        renderHTML: (attrs) => ({
          'data-forum-poll': attrs.pollId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-forum-poll]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ForumPollTiptapView);
  },
});
