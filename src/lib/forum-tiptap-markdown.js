/**
 * Markdown ↔ TipTap helpers for forum embed atom nodes (polls, YouTube).
 */

import { POLL_TOKEN_RE } from './forum-poll.js';
import { YOUTUBE_TOKEN_RE } from './forum-youtube.js';

const EMBED_TOKEN_RE = new RegExp(
  `(${POLL_TOKEN_RE.source}|${YOUTUBE_TOKEN_RE.source})`,
  'gi',
);

/**
 * @param {string} md
 * @returns {Array<{ type: 'md' | 'poll' | 'youtube', text?: string, pollId?: string, videoId?: string }>}
 */
export function splitMarkdownByEmbeds(md) {
  const text = String(md || '');
  const parts = [];
  const re = new RegExp(EMBED_TOKEN_RE.source, 'gi');
  let last = 0;
  let match = re.exec(text);

  while (match) {
    if (match.index > last) {
      parts.push({ type: 'md', text: text.slice(last, match.index) });
    }

    const poll = match[0].match(/^::poll\[([0-9a-f-]{36})\]$/i);
    const youtube = match[0].match(/^::youtube\[([a-zA-Z0-9_-]{11})\]$/i);
    if (poll) {
      parts.push({ type: 'poll', pollId: poll[1] });
    } else if (youtube) {
      parts.push({ type: 'youtube', videoId: youtube[1] });
    } else {
      parts.push({ type: 'md', text: match[0] });
    }

    last = match.index + match[0].length;
    match = re.exec(text);
  }

  if (last < text.length) {
    parts.push({ type: 'md', text: text.slice(last) });
  }

  if (!parts.length) {
    parts.push({ type: 'md', text: '' });
  }

  return parts;
}

/** @deprecated use splitMarkdownByEmbeds */
export function splitMarkdownByPollTokens(md) {
  return splitMarkdownByEmbeds(md);
}

function hasForumEmbedNodes(editor) {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'forumPoll' || node.type.name === 'forumYoutube') {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}

function inlineNodeToMarkdown(node) {
  if (!node.isText) return '';
  let text = node.text;
  for (const mark of node.marks) {
    if (mark.type.name === 'bold') text = `**${text}**`;
    else if (mark.type.name === 'italic') text = `*${text}*`;
    else if (mark.type.name === 'link') {
      const href = mark.attrs.href || '';
      text = `[${text}](${href})`;
    }
  }
  return text;
}

function blockNodeToMarkdown(node) {
  const name = node.type.name;

  if (name === 'paragraph') {
    let line = '';
    node.forEach((child) => {
      line += inlineNodeToMarkdown(child);
    });
    return line;
  }

  if (name === 'heading') {
    const level = node.attrs.level || 2;
    return `${'#'.repeat(level)} ${node.textContent}`;
  }

  if (name === 'bulletList') {
    const lines = [];
    node.forEach((item) => {
      item.forEach((child) => {
        if (child.type.name === 'paragraph') {
          lines.push(`- ${child.textContent}`);
        }
      });
    });
    return lines.join('\n');
  }

  if (name === 'orderedList') {
    const lines = [];
    let i = 1;
    node.forEach((item) => {
      item.forEach((child) => {
        if (child.type.name === 'paragraph') {
          lines.push(`${i}. ${child.textContent}`);
          i += 1;
        }
      });
    });
    return lines.join('\n');
  }

  if (name === 'image') {
    const alt = node.attrs.alt || '';
    const src = node.attrs.src || '';
    return `![${alt}](${src})`;
  }

  if (name === 'blockquote') {
    return node.textContent
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }

  if (name === 'codeBlock') {
    return `\`\`\`\n${node.textContent}\n\`\`\``;
  }

  if (name === 'horizontalRule') {
    return '---';
  }

  return node.textContent || '';
}

function serializeEmbedNode(node) {
  if (node.type.name === 'forumPoll') {
    return `::poll[${node.attrs.pollId}]`;
  }
  if (node.type.name === 'forumYoutube') {
    return `::youtube[${node.attrs.videoId}]`;
  }
  return null;
}

/**
 * @param {import('@tiptap/core').Editor} editor
 */
export function getForumEditorMarkdown(editor) {
  if (!editor || editor.isDestroyed) return '';

  if (!hasForumEmbedNodes(editor)) {
    return editor.storage.markdown?.getMarkdown?.() ?? editor.getText();
  }

  const segments = [];
  let mdNodes = [];

  const flush = () => {
    if (!mdNodes.length) return;
    const lines = mdNodes.map(blockNodeToMarkdown).filter((line) => line !== '');
    if (lines.length) segments.push(lines.join('\n\n'));
    mdNodes = [];
  };

  editor.state.doc.forEach((node) => {
    const embed = serializeEmbedNode(node);
    if (embed) {
      flush();
      segments.push(embed);
    } else {
      mdNodes.push(node);
    }
  });

  flush();
  return segments.join('\n\n').trim();
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} md
 */
export function setForumEditorMarkdown(editor, md) {
  if (!editor || editor.isDestroyed) return;

  const parts = splitMarkdownByEmbeds(md);
  const hasEmbeds = parts.some((p) => p.type === 'poll' || p.type === 'youtube');

  if (!hasEmbeds) {
    editor.commands.setContent(md || '', false, { contentType: 'markdown' });
    return;
  }

  editor.commands.clearContent(false);

  let chain = editor.chain();
  if (!chain) return;

  for (const part of parts) {
    if (part.type === 'poll') {
      chain = chain.insertContent({ type: 'forumPoll', attrs: { pollId: part.pollId } });
    } else if (part.type === 'youtube') {
      chain = chain.insertContent({ type: 'forumYoutube', attrs: { videoId: part.videoId } });
    } else if (part.text) {
      chain = chain.insertContent(part.text, { contentType: 'markdown' });
    }
  }

  chain.run();
}
