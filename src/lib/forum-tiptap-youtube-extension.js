import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ForumYoutubeTiptapView from '../components/ForumYoutubeTiptapView.js';

export const ForumYoutubeNode = Node.create({
  name: 'forumYoutube',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      videoId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-forum-youtube'),
        renderHTML: (attrs) => ({
          'data-forum-youtube': attrs.videoId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-forum-youtube]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ForumYoutubeTiptapView);
  },
});
