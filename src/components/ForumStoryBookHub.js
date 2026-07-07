import { useState } from 'react';
import { optimizeForumDisplayUrl } from '../lib/cloudinary-forum-upload.js';
import ForumAuthorName from './ForumAuthorName.js';
import ForumComposeOverlay from './ForumComposeOverlay.js';
import ForumStoryAddChapter from './ForumStoryAddChapter.js';
import ForumStoryCoverEdit from './ForumStoryCoverEdit.js';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ForumStoryBookHub({
  post,
  chapters,
  chaptersLoading = false,
  resumeChapterNumber = 1,
  hasReadingProgress = false,
  readingResumeReady = false,
  accessToken,
  onEnterRead,
  onReadChapter,
  onChaptersChange,
  onPostUpdate,
  onLike,
  onBookmark,
  onScrollToComments,
  likingPost,
  bookmarking,
  reportButton,
  reportNotice,
}) {
  const [showAddChapter, setShowAddChapter] = useState(false);

  const nextChapterNumber = (chapters?.reduce(
    (max, ch) => Math.max(max, ch.chapter_number || 0),
    0,
  ) || 0) + 1;

  const resumeChapter = chapters.find((ch) => ch.chapter_number === resumeChapterNumber)
    || chapters[0];
  const enterReadLabel = readingResumeReady && hasReadingProgress ? '繼續閱讀' : '進入閱讀';
  const enterReadSub = !readingResumeReady
    ? null
    : hasReadingProgress && resumeChapter
      ? `繼續閱讀：${resumeChapter.display_title || `第${resumeChapter.chapter_number}章`}`
      : `由 ${chapters[0]?.display_title || '第一章'} 開始`;

  const canEditCover = post.is_mine && accessToken;
  const showCoverColumn = post.cover_image_url || canEditCover;

  return (
    <article className="forum-story-reader forum-story-reader--hub">
      <div className={`forum-story-reader__masthead${showCoverColumn ? ' forum-story-reader__masthead--with-cover' : ''}`}>
        {showCoverColumn && (
          <div className="forum-story-reader__cover-wrap">
            {canEditCover ? (
              <ForumStoryCoverEdit
                postId={post.id}
                coverUrl={post.cover_image_url}
                accessToken={accessToken}
                onUpdated={(patch) => onPostUpdate?.(patch)}
              />
            ) : (
              <div className="forum-story-reader__cover-hero">
                <img
                  src={optimizeForumDisplayUrl(post.cover_image_url)}
                  alt=""
                  className="forum-story-reader__cover-img"
                />
                <span className="forum-story-reader__cover-spine" aria-hidden="true" />
                <span className="forum-story-reader__cover-shine" aria-hidden="true" />
              </div>
            )}
          </div>
        )}

        <header className="forum-story-reader__head">
          <div className="forum-story-reader__head-top">
            <span className="forum-story-reader__eyebrow">📖 寫故事</span>
            {post.visibility === 'members_only' && (
              <span className="forum-visibility-badge forum-story-reader__badge">🔒 會員限定</span>
            )}
          </div>

          <h1 className="forum-story-reader__title">{post.title || '無題'}</h1>
          <div className="forum-story-reader__title-rule" aria-hidden="true" />

          <div className="forum-story-reader__meta-row">
            <div className="forum-story-reader__byline">
              <ForumAuthorName
                name={post.author?.display_name}
                isMine={post.is_mine}
                isPremium={post.author?.is_premium}
                mirrorSlug={post.author?.mirror_slug}
              />
              {post.created_at && (
                <>
                  <span className="forum-story-reader__meta-dot" aria-hidden="true">·</span>
                  <time className="forum-story-reader__date" dateTime={post.created_at}>
                    {formatDate(post.created_at)}
                  </time>
                </>
              )}
            </div>
            <div className="forum-story-reader__stats">
              <span className="forum-story-reader__stat">
                {chaptersLoading ? '載入章節…' : `共 ${chapters.length} 章`}
              </span>
              <span className="forum-story-reader__meta-dot" aria-hidden="true">·</span>
              <span className="forum-story-reader__stat">{post.comment_count || 0} 留言</span>
            </div>
          </div>
        </header>

        {post.synopsis && (
          <figure className="forum-story-reader__synopsis-block">
            <figcaption className="forum-story-reader__synopsis-head">
              <span className="forum-story-reader__synopsis-sigil" aria-hidden="true">📜</span>
              <span className="forum-story-reader__synopsis-label">簡介</span>
            </figcaption>
            <blockquote className="forum-story-reader__synopsis">{post.synopsis}</blockquote>
          </figure>
        )}
      </div>

      <section className="forum-story-chapters" aria-labelledby="story-chapters-title">
        <div className="forum-story-chapters__frame">
          <div className="forum-story-chapters__head">
            <span className="forum-story-chapters__sigil" aria-hidden="true">📚</span>
            <div className="forum-story-chapters__head-copy">
              <div className="forum-story-chapters__title-row">
                <h2 id="story-chapters-title" className="forum-story-chapters__title">章節目錄</h2>
                <span className="forum-story-chapters__count">
                  {chaptersLoading ? '…' : `${chapters.length} 章`}
                </span>
              </div>
              <p className="forum-story-chapters__sub">點選章節，或從頭開始閱讀</p>
            </div>
          </div>

          {chaptersLoading ? (
            <div className="forum-story-chapters__loading" aria-live="polite">
              <span className="forum-story-chapters__loading-text">載入章節…</span>
            </div>
          ) : chapters.length > 0 ? (
            <ol className="forum-story-chapters__list">
              {chapters.map((ch, index) => (
                <li key={ch.id || ch.chapter_number} className="forum-story-chapters__item">
                  <button
                    type="button"
                    className="forum-story-chapters__link"
                    onClick={() => onReadChapter(ch.chapter_number)}
                  >
                    <span className="forum-story-chapters__spine" aria-hidden="true" />
                    <span className="forum-story-chapters__num">{String(ch.chapter_number).padStart(2, '0')}</span>
                    <span className="forum-story-chapters__name-wrap">
                      <span className="forum-story-chapters__name">{ch.display_title}</span>
                      {index === 0 && chapters.length === 1 && (
                        <span className="forum-story-chapters__hint">最新</span>
                      )}
                      {index === chapters.length - 1 && chapters.length > 1 && (
                        <span className="forum-story-chapters__hint">最新</span>
                      )}
                    </span>
                    <span className="forum-story-chapters__arrow" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="forum-story-chapters__empty">
              <span className="forum-story-chapters__empty-icon" aria-hidden="true">📖</span>
              <p>作者尚未發佈章節。</p>
            </div>
          )}

          {!chaptersLoading && chapters.length > 0 && (
            <div className="forum-story-chapters__cta-row">
              <button
                type="button"
                className="forum-story-reader__enter-read"
                onClick={() => onEnterRead()}
              >
                <span className="forum-story-reader__enter-read-icon" aria-hidden="true">📖</span>
                <span className="forum-story-reader__enter-read-text">
                  <span className="forum-story-reader__enter-read-label">{enterReadLabel}</span>
                  {enterReadSub && (
                    <span className="forum-story-reader__enter-read-sub">{enterReadSub}</span>
                  )}
                </span>
              </button>
            </div>
          )}

          {post.is_mine && accessToken && (
            <div className="forum-story-chapters__author">
              <button
                type="button"
                className="forum-story-chapters__add-btn"
                onClick={() => setShowAddChapter(true)}
              >
                <span className="forum-story-chapters__add-icon" aria-hidden="true">✍️</span>
                <span>續寫新一章</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {showAddChapter && (
        <ForumComposeOverlay
          modalClassName="forum-compose-modal--story forum-compose-modal--add-chapter"
          ariaLabelledBy="forum-story-add-chapter-title"
        >
          <ForumStoryAddChapter
            postId={post.id}
            accessToken={accessToken}
            nextChapterNumber={nextChapterNumber}
            onAdded={(updated) => {
              onChaptersChange?.(updated);
              setShowAddChapter(false);
            }}
            onCancel={() => setShowAddChapter(false)}
          />
        </ForumComposeOverlay>
      )}

      <footer className="forum-story-reader__actions">
        <button
          type="button"
          onClick={onLike}
          disabled={post.viewer_liked || likingPost}
          className={`forum-stat-btn forum-stat-btn--like${post.viewer_liked ? ' forum-stat-btn--liked' : ''}`}
        >
          <span aria-hidden="true">💗</span>
          <span>{post.like_count}</span>
        </button>
        <button type="button" onClick={onScrollToComments} className="forum-stat-btn forum-stat-btn--comment">
          <span aria-hidden="true">💬</span>
          <span>{post.comment_count}</span>
        </button>
        <button
          type="button"
          onClick={onBookmark}
          disabled={bookmarking}
          className={`forum-stat-btn forum-stat-btn--bookmark${post.viewer_bookmarked ? ' forum-stat-btn--bookmarked' : ''}`}
        >
          <span aria-hidden="true">🔖</span>
          <span>{post.viewer_bookmarked ? '已收藏' : '收藏'}</span>
        </button>
        {reportButton}
      </footer>
      {reportNotice && (
        <p className="forum-report-notice" role="status">{reportNotice}</p>
      )}
    </article>
  );
}
