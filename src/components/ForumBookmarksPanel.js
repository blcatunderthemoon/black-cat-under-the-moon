/**
 * 黑貓書櫃 overlay — private bookshelf of saved forum posts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { storyFeedPreviewText, isStoryPost } from '../lib/forum-story.js';
import { TOPIC_STYLES, displayTopic, forumTopicLabel } from '../lib/forum-welcome.js';
import ForumPostTags from './ForumPostTags.js';
import ForumAuthorName from './ForumAuthorName.js';
import { forumListPreviewText } from '../lib/forum-list-preview.js';
import { ForumLikeStat, ForumCommentStat, ForumBookIcon } from './ForumIcons.js';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return '剛才';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 日前`;
}

export default function ForumBookmarksPanel({ open, onClose, accessToken, onBookmarkChange = null }) {
  const [posts, setPosts] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const offsetRef = useRef(0);

  const load = useCallback(async (reset = false) => {
    if (!accessToken) return;
    const newOffset = reset ? 0 : offsetRef.current;
    try {
      const r = await fetch(`/api/forum/posts?sort=saved&limit=20&offset=${newOffset}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLoadError(data.error || '無法翻閱書櫃。');
        setPosts([]);
        setHasMore(false);
        return;
      }
      const incoming = data.posts || [];
      setPosts(reset ? incoming : (prev) => [...(prev || []), ...incoming]);
      setHasMore(data.has_more || false);
      setLoadError('');
      const nextOffset = newOffset + 20;
      offsetRef.current = nextOffset;
    } catch {
      setLoadError('網路錯誤，請重試。');
      setPosts([]);
      setHasMore(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    html.classList.add('body-scroll-locked');
    document.body.classList.add('body-scroll-locked');
    return () => {
      html.classList.remove('body-scroll-locked');
      document.body.classList.remove('body-scroll-locked');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    offsetRef.current = 0;
    setPosts(null);
    setLoadError('');
    load(true);
  }, [open, load]);

  async function removeBookmark(postId, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!accessToken || removingIds.has(postId)) return;

    setRemovingIds((prev) => new Set(prev).add(postId));
    try {
      const r = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}?action=bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(result.error || '無法從書櫃取下，請稍後再試。');
        return;
      }
      if (!result.bookmarked) {
        setPosts((prev) => (prev || []).filter((p) => p.id !== postId));
        onBookmarkChange?.(postId, false);
      }
    } catch {
      alert('網路錯誤，請重試。');
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  if (!open || typeof document === 'undefined') return null;

  const isEmpty = posts !== null && posts.length === 0;

  return createPortal(
    <div className="forum-bookmarks-overlay" onClick={onClose} role="presentation">
      <div
        className="forum-bookmarks-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forum-bookmarks-title"
      >
        <header className="forum-bookmarks-panel__header">
          <div className="forum-bookmarks-panel__heading">
            <h2 id="forum-bookmarks-title" className="forum-bookmarks-panel__title">
              <span className="forum-bookmarks-panel__title-icon" aria-hidden="true">
                <ForumBookIcon size={18} />
              </span>
              <span className="forum-bookmarks-panel__title-text">黑貓書櫃</span>
            </h2>
            <p className="forum-bookmarks-panel__sub">你收藏的貼文，只屬於你的私人清單。</p>
          </div>
          <button type="button" className="forum-bookmarks-panel__close" onClick={onClose} aria-label="關閉書櫃">
            ✕
          </button>
        </header>

        {posts === null ? (
          <p className="forum-bookmarks-panel__status pixel-muted">正在翻閱書櫃…</p>
        ) : loadError ? (
          <p className="pixel-error">{loadError}</p>
        ) : isEmpty ? (
          <div className="forum-bookmarks-empty">
            <p className="forum-bookmarks-empty__emoji" aria-hidden="true">
              <ForumBookIcon size={28} />
            </p>
            <p className="forum-bookmarks-empty__text">書櫃尚空</p>
            <p className="forum-bookmarks-empty__hint">
              在樹洞貼文按收藏收入書櫃，<br />
              只有你能翻閱這些私藏。
            </p>
          </div>
        ) : (
          <ul className="pixel-list forum-bookmarks-list">
            {posts.map((post) => {
              const preview = isStoryPost(post)
                ? storyFeedPreviewText(post, 160)
                : forumListPreviewText(post.content || '', { maxLength: 160 });
              return (
              <li key={post.id}>
                <article className="forum-bookmarks-item">
                  <button
                    type="button"
                    className="forum-bookmarks-item__remove"
                    title="從書櫃取下"
                    aria-label="從書櫃取下"
                    disabled={removingIds.has(post.id)}
                    onClick={(e) => removeBookmark(post.id, e)}
                  >
                    ✕
                  </button>
                  <Link href={`/forum/${post.id}`} className="forum-bookmarks-item__link" onClick={onClose}>
                    <div className="forum-bookmarks-item__tags">
                      <span
                        className="pixel-tag"
                        style={{
                          color: TOPIC_STYLES[displayTopic(post.topic)]?.accent || 'var(--purple-light)',
                          borderColor: `${TOPIC_STYLES[displayTopic(post.topic)]?.accent || '#bd93f9'}55`,
                        }}
                      >
                        {forumTopicLabel(post.topic)}
                      </span>
                      <ForumPostTags tags={post.tags} variant="compact" />
                    </div>
                    {post.title && <h3 className="forum-bookmarks-item__title">{post.title}</h3>}
                    {preview && (
                      <p className="forum-bookmarks-item__preview">{preview}</p>
                    )}
                    <div className="forum-bookmarks-item__meta">
                      <ForumAuthorName
                        name={post.anonymous_name_snapshot}
                        isMine={post.is_mine}
                        isPremium={post.author_is_premium}
                        mirrorSlug={post.author_mirror_slug}
                        onLinkClick={(e) => {
                          e.stopPropagation();
                          onClose?.();
                        }}
                      />
                      <span className="forum-bookmarks-item__stats">
                        <ForumLikeStat count={post.like_count} />
                        <ForumCommentStat count={post.comment_count} />
                      </span>
                      <span className="forum-bookmarks-item__time">{timeAgo(post.created_at)}</span>
                    </div>
                  </Link>
                </article>
              </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <button type="button" onClick={() => load(false)} className="pixel-btn pixel-btn--ghost forum-bookmarks-panel__more">
            載入更多
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
