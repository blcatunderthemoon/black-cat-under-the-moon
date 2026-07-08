import { useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isMentionUserId } from '../lib/forum-mentions.js';
import { parseForumContentSegments } from '../lib/forum-content-segments.js';
import { splitLegacyPollBlocks } from '../lib/forum-poll.js';
import { optimizeForumDisplayUrl } from '../lib/cloudinary-forum-upload.js';
import { preserveMarkdownLeadingSpaces, isForumBlankLineChunk, hasMarkdownChunkText, normalizeStoryMarkdownForDisplay } from '../lib/forum-story.js';
import ForumYoutubeEmbed from './ForumYoutubeEmbed.js';
import ForumPoll from './ForumPoll.js';

function MarkdownLink({ href, children }) {
  if (isMentionUserId(href)) {
    return (
      <Link href="/account" className="forum-mention-link">
        @{children}
      </Link>
    );
  }
  const safeHref = String(href || '');
  if (!/^https?:\/\//i.test(safeHref)) {
    return <span>{children}</span>;
  }
  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer" className="forum-md-link">
      {children}
    </a>
  );
}

function MarkdownImage({ src, alt }) {
  const safeSrc = optimizeForumDisplayUrl(String(src || ''));
  if (!/^https:\/\//i.test(safeSrc)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeSrc}
      alt={alt || '圖片'}
      className="forum-md-image"
      loading="lazy"
      decoding="async"
    />
  );
}

function ForumSpoiler({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={`forum-spoiler${open ? ' forum-spoiler--open' : ''}`}
      onClick={() => setOpen((v) => !v)}
      aria-pressed={open}
    >
      {open ? text : '點擊顯示隱藏內容'}
    </button>
  );
}

function MarkdownParagraph({ children }) {
  const childList = Array.isArray(children) ? children : [children];
  const isSpacer = childList.length > 0 && childList.every((child) => (
    child === '\u00A0'
    || (typeof child === 'string' && !child.replace(/\u00A0/g, '').trim())
  ));

  if (isSpacer) {
    return <p className="forum-md-body__p forum-md-body__p--spacer" aria-hidden="true" />;
  }

  return <p className="forum-md-body__p">{children}</p>;
}

function MarkdownHr() {
  return <hr className="forum-md-body__hr" />;
}

function MarkdownChunk({ text, storyMode = false }) {
  const parts = useMemo(() => splitLegacyPollBlocks(text), [text]);

  if (!parts.length) return null;

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'legacy_poll') {
          const legacyPoll = {
            id: `legacy-${index}`,
            title: part.title,
            options: part.options,
            counts: part.options.map(() => 0),
            total_votes: 0,
            has_voted: false,
          };
          return <ForumPoll key={`legacy-poll-${index}`} poll={legacyPoll} legacy />;
        }
        if (!hasMarkdownChunkText(part.text)) return null;
        const displayText = storyMode
          ? normalizeStoryMarkdownForDisplay(part.text)
          : part.text;
        return (
          <ReactMarkdown
            key={`md-chunk-${index}`}
            remarkPlugins={[remarkGfm]}
            components={{
              a: MarkdownLink,
              img: MarkdownImage,
              p: MarkdownParagraph,
              hr: MarkdownHr,
              input: () => null,
            }}
          >
            {preserveMarkdownLeadingSpaces(displayText)}
          </ReactMarkdown>
        );
      })}
    </>
  );
}

function resolvePoll(pollId, pollsById, previewPolls) {
  const map = previewPolls || pollsById || {};
  const poll = map[pollId];
  if (!poll) return null;
  return {
    id: poll.id,
    title: poll.title || '投票',
    options: poll.options || [],
    counts: poll.counts || (poll.options || []).map(() => 0),
    total_votes: poll.total_votes || 0,
    viewer_option_index: poll.viewer_option_index ?? null,
    has_voted: !!poll.has_voted,
  };
}

export default function ForumMarkdownBody({
  content,
  className = '',
  storyMode = false,
  pollsById = {},
  previewPolls = null,
  preview = false,
  loggedIn = false,
  accessToken,
  onPollVote,
}) {
  const segments = useMemo(
    () => parseForumContentSegments(content),
    [content],
  );

  if (!segments.length) return null;

  return (
    <div className={`forum-md-body ${className}`.trim()}>
      {segments.map((seg, index) => {
        if (seg.type === 'spoiler') {
          return <ForumSpoiler key={`spoiler-${index}`} text={seg.text} />;
        }
        if (seg.type === 'youtube') {
          return <ForumYoutubeEmbed key={`yt-${index}`} videoId={seg.videoId} />;
        }
        if (seg.type === 'poll') {
          const poll = resolvePoll(seg.pollId, pollsById, previewPolls);
          if (!poll) {
            const draft = previewPolls?.[seg.pollId] || pollsById?.[seg.pollId];
            if (draft) {
              return (
                <ForumPoll
                  key={`poll-${seg.pollId}`}
                  poll={{
                    id: draft.id,
                    title: draft.title,
                    options: draft.options,
                    counts: draft.options.map(() => 0),
                    total_votes: 0,
                    has_voted: false,
                  }}
                  preview={preview}
                />
              );
            }
            return (
              <div key={`poll-missing-${index}`} className="forum-poll forum-poll--missing">
                <p className="forum-poll__title">📊 投票</p>
                <p className="forum-poll__hint">投票資料無法載入</p>
              </div>
            );
          }
          return (
            <ForumPoll
              key={`poll-${seg.pollId}`}
              poll={poll}
              preview={preview}
              loggedIn={loggedIn}
              accessToken={accessToken}
              onVote={(updated) => onPollVote?.(seg.pollId, updated)}
            />
          );
        }
        return <MarkdownChunk key={`md-${index}`} text={seg.text} storyMode={storyMode} />;
      })}
    </div>
  );
}
