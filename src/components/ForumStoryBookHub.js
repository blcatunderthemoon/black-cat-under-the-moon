import { useState } from 'react';
import { optimizeForumDisplayUrl } from '../lib/cloudinary-forum-upload.js';
import { resolveStorySynopsis } from '../lib/forum-story.js';
import { formatStoryViewCount } from '../lib/forum-story-views.js';
import { isGuestReadableChapter } from '../lib/forum-story-chapters.js';
import ForumAuthorName from './ForumAuthorName.js';
import ForumComposeOverlay from './ForumComposeOverlay.js';
import ForumStoryAddChapter from './ForumStoryAddChapter.js';
import ForumStoryCoverEdit from './ForumStoryCoverEdit.js';
import ForumStoryEditChapter from './ForumStoryEditChapter.js';
import ForumStorySynopsisEdit from './ForumStorySynopsisEdit.js';
import LoadingText from './LoadingText.js';
import MoonLoading from './MoonLoading.js';

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
  chapterCount,
  loggedIn = true,
  loginHref = '/login',
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
  const [editingSynopsis, setEditingSynopsis] = useState(false);
  const [editingChapter, setEditingChapter] = useState(null);
  const [togglingComplete, setTogglingComplete] = useState(false);

  const canEdit = !!post.is_mine && loggedIn;
  const canSave = canEdit && !!accessToken;

  function openSynopsisEdit() {
    if (!canSave) return;
    setEditingChapter(null);
    setShowAddChapter(false);
    setEditingSynopsis(true);
  }

  function openChapterEdit(ch) {
    if (!canSave) return;
    setEditingSynopsis(false);
    setShowAddChapter(false);
    setEditingChapter(ch);
  }

  function openAddChapter() {
    if (!canSave || post.story_completed) return;
    setEditingSynopsis(false);
    setEditingChapter(null);
    setShowAddChapter(true);
  }

  async function toggleStoryCompleted() {
    if (!canSave || togglingComplete) return;
    const next = !post.story_completed;
    setTogglingComplete(true);
    try {
      const res = await fetch(`/api/forum/posts/${encodeURIComponent(post.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ story_completed: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn(payload.error || '更新完結狀態失敗');
        return;
      }
      onPostUpdate?.({
        story_completed: payload.post?.story_completed ?? next,
      });
      if (next) setShowAddChapter(false);
    } catch {
      console.warn('更新完結狀態失敗');
    } finally {
      setTogglingComplete(false);
    }
  }

  const visibleChapterCount = chaptersLoading
    ? null
    : (loggedIn ? chapters?.length : chapterCount ?? chapters?.length ?? 0);

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
      ? (resumeChapter.display_title || `第 ${resumeChapter.chapter_number} 章`)
      : `由 ${chapters[0]?.display_title || '第一章'} 開始`;
  const enterReadResume = readingResumeReady && hasReadingProgress;

  const canEditCover = canEdit;
  const showCoverColumn = post.cover_image_url || canEditCover;
  const displaySynopsis = resolveStorySynopsis(post);
  const showSynopsisBlock = !!displaySynopsis || canEdit;

  return (
    <article className="forum-story-reader forum-story-reader--hub">
      <div className={`forum-story-reader__masthead${showCoverColumn ? ' forum-story-reader__masthead--with-cover' : ''}`}>
        {canEdit && (
          <div className="forum-story-reader__complete-action">
            <button
              type="button"
              className={`forum-story-complete-btn${post.story_completed ? ' forum-story-complete-btn--done' : ''}`}
              onClick={toggleStoryCompleted}
              disabled={togglingComplete}
              aria-pressed={!!post.story_completed}
            >
              {togglingComplete
                ? '更新中…'
                : post.story_completed
                  ? '取消完結'
                  : '標記完結'}
            </button>
          </div>
        )}
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
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
            {post.story_completed && (
              <span className="forum-story-reader__complete-badge">✓ 完結</span>
            )}
            {post.visibility === 'members_only' && (
              <span className="forum-visibility-badge forum-story-reader__badge">🔒 會員限定</span>
            )}
          </div>

          <h1 className="forum-story-reader__title">{post.title || '無題'}</h1>
          <div className="forum-story-reader__title-rule" aria-hidden="true" />

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

          <div className="forum-story-reader__stats" aria-label="書籍數據">
            <span className="forum-story-reader__stat">
              <span className="forum-story-reader__stat-icon" aria-hidden="true">📖</span>
              <span className="forum-story-reader__stat-text">
                {chaptersLoading ? (
                  <LoadingText as="span" className="forum-story-reader__stat-text" />
                ) : `共 ${visibleChapterCount ?? 0} 章`}
              </span>
            </span>
            <span className="forum-story-reader__stat">
              <span className="forum-story-reader__stat-icon" aria-hidden="true">💬</span>
              <span className="forum-story-reader__stat-text">{post.comment_count || 0} 留言</span>
            </span>
            <span className="forum-story-reader__stat" title="累計閱讀次數">
              <span className="forum-story-reader__stat-icon" aria-hidden="true">👁</span>
              <span className="forum-story-reader__stat-text">
                {formatStoryViewCount(post.view_count)} 閱讀
              </span>
            </span>
          </div>
        </header>

        {showSynopsisBlock && (
        <figure className="forum-story-reader__synopsis-block">
          <figcaption className="forum-story-reader__synopsis-head">
            <div className="forum-story-reader__synopsis-head-main">
              <span className="forum-story-reader__synopsis-sigil" aria-hidden="true">📜</span>
              <span className="forum-story-reader__synopsis-label">簡介</span>
            </div>
            {canEdit && (
              <button
                type="button"
                className="forum-story-synopsis-read__edit-btn"
                onClick={openSynopsisEdit}
              >
                編輯簡介
              </button>
            )}
          </figcaption>
          {displaySynopsis ? (
            <blockquote className="forum-story-reader__synopsis">{displaySynopsis}</blockquote>
          ) : (
            <p className="forum-story-synopsis-read__empty">尚未撰寫簡介。</p>
          )}
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
                  {chaptersLoading ? '…' : `${visibleChapterCount ?? 0} 章`}
                </span>
              </div>
              <p className="forum-story-chapters__sub">
                {loggedIn ? '點選章節，或從頭開始閱讀' : '訪客可免費閱讀前三章，登入後閱讀全部'}
              </p>
            </div>
          </div>

          {chaptersLoading ? (
            <div className="forum-story-chapters__loading" aria-live="polite">
              <MoonLoading variant="inline" centered size={48} />
            </div>
          ) : chapters.length > 0 ? (
            <ol className="forum-story-chapters__list">
              {chapters.map((ch, index) => {
                const locked = !isGuestReadableChapter(ch.chapter_number, loggedIn);
                return (
                <li key={ch.id || ch.chapter_number} className="forum-story-chapters__item">
                  <div className="forum-story-chapters__row">
                    <button
                      type="button"
                      className={`forum-story-chapters__link${locked ? ' forum-story-chapters__link--locked' : ''}`}
                      onClick={() => {
                        if (locked) {
                          window.location.href = loginHref;
                          return;
                        }
                        onReadChapter(ch.chapter_number);
                      }}
                      aria-label={
                        locked
                          ? `${ch.display_title}（登入後可閱讀）`
                          : ch.display_title
                      }
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
                      {locked ? (
                        <span className="forum-story-chapters__lock" aria-hidden="true">🔒</span>
                      ) : (
                        <span className="forum-story-chapters__arrow" aria-hidden="true">›</span>
                      )}
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className="forum-story-chapters__edit-btn"
                        onClick={() => openChapterEdit(ch)}
                        aria-label={`編輯 ${ch.display_title}`}
                      >
                        編輯
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
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
                className={[
                  'forum-story-reader__enter-read',
                  enterReadResume ? 'forum-story-reader__enter-read--resume' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onEnterRead()}
              >
                <span className="forum-story-reader__enter-read-leading" aria-hidden="true">
                  <span className="forum-story-reader__enter-read-icon">📖</span>
                </span>
                <span className="forum-story-reader__enter-read-text">
                  <span className="forum-story-reader__enter-read-label">{enterReadLabel}</span>
                  {enterReadSub && (
                    <span className="forum-story-reader__enter-read-sub">{enterReadSub}</span>
                  )}
                </span>
                <span className="forum-story-reader__enter-read-arrow" aria-hidden="true">›</span>
              </button>
            </div>
          )}

          {canEdit && !post.story_completed && (
            <div className="forum-story-chapters__author">
              <button
                type="button"
                className="forum-story-chapters__add-btn"
                onClick={openAddChapter}
              >
                <span className="forum-story-chapters__add-icon" aria-hidden="true">✍️</span>
                <span>續寫新一章</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {editingSynopsis && canSave && (
        <ForumComposeOverlay
          modalClassName="forum-compose-modal--story forum-compose-modal--synopsis"
          ariaLabelledBy="forum-story-synopsis-title"
        >
          <ForumStorySynopsisEdit
            postId={post.id}
            synopsis={post.synopsis || displaySynopsis || ''}
            accessToken={accessToken}
            onSaved={(patch) => {
              onPostUpdate?.(patch);
              setEditingSynopsis(false);
            }}
            onCancel={() => setEditingSynopsis(false)}
          />
        </ForumComposeOverlay>
      )}

      {editingChapter && canSave && (
        <ForumComposeOverlay
          modalClassName="forum-compose-modal--story forum-compose-modal--add-chapter"
          ariaLabelledBy="forum-story-edit-chapter-title"
        >
          <ForumStoryEditChapter
            key={editingChapter.id || `ch-${editingChapter.chapter_number}`}
            postId={post.id}
            chapter={editingChapter}
            accessToken={accessToken}
            onSaved={(updated) => {
              onChaptersChange?.(updated);
              setEditingChapter(null);
            }}
            onCancel={() => setEditingChapter(null)}
          />
        </ForumComposeOverlay>
      )}

      {showAddChapter && canSave && !post.story_completed && (
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
