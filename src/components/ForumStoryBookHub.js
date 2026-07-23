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

/** Deterministic hue (0–359) from the title so each book gets a stable accent. */
function storyCoverHue(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** On-brand generated cover for stories without an uploaded cover image. */
function StoryPlaceholderCover({ title }) {
  const hue = storyCoverHue(title || '無題');
  return (
    <div
      className="forum-story-reader__cover-hero forum-story-reader__cover-hero--gen"
      style={{ '--cover-hue': hue }}
    >
      <div className="forum-story-cover-gen">
        <span className="forum-story-cover-gen__moon" aria-hidden="true" />
        <span className="forum-story-cover-gen__eyebrow">STORY</span>
        <span className="forum-story-cover-gen__title">{title || '無題'}</span>
        <span className="forum-story-cover-gen__cat" aria-hidden="true">🐈‍⬛</span>
      </div>
      <span className="forum-story-reader__cover-spine" aria-hidden="true" />
      <span className="forum-story-reader__cover-shine" aria-hidden="true" />
    </div>
  );
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
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState('');

  const canEdit = !!post.is_mine && loggedIn;
  const canSave = canEdit && !!accessToken;
  // Show reorder controls whenever the author can see Edit (don't hide behind token timing)
  const canReorder = canEdit && (chapters?.length || 0) >= 2;

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

  async function moveChapter(chapterId, direction) {
    if (!canReorder || reordering) return;
    if (!accessToken) {
      setReorderError('登入狀態已過期，請重新登入後再調整順序。');
      return;
    }
    const list = [...(chapters || [])];
    const idx = list.findIndex((ch) => String(ch.id) === String(chapterId));
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return;
    if (!list[idx]?.id || list[idx].id === 'legacy-1' || !list[swapWith]?.id || list[swapWith].id === 'legacy-1') {
      setReorderError('請先編輯並儲存舊版第一章，再調整順序。');
      return;
    }

    const next = [...list];
    const tmp = next[idx];
    next[idx] = next[swapWith];
    next[swapWith] = tmp;
    const orderedIds = next.map((ch) => String(ch.id));

    setReordering(true);
    setReorderError('');
    try {
      const res = await fetch(`/api/forum/posts/${encodeURIComponent(post.id)}/chapters/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReorderError(payload.error || '調整順序失敗');
        return;
      }
      onChaptersChange?.(payload.chapters || []);
    } catch {
      setReorderError('調整順序失敗，請稍後再試');
    } finally {
      setReordering(false);
    }
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
  const hasRealCover = !!post.cover_image_url;
  const showPlaceholderCover = !hasRealCover && !canEditCover;
  const showCoverColumn = hasRealCover || canEditCover || showPlaceholderCover;
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
            ) : hasRealCover ? (
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
            ) : (
              <StoryPlaceholderCover title={post.title} />
            )}
          </div>
        )}

        <header className="forum-story-reader__head">
          <div className="forum-story-reader__head-top">
            <span className="forum-story-reader__eyebrow">📖 故事</span>
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
                {loggedIn
                  ? (canReorder
                    ? '點選章節閱讀；右側 ↑↓ 可調順序'
                    : '點選章節，或從頭開始閱讀')
                  : '訪客可免費閱讀前三章，登入後閱讀全部'}
              </p>
            </div>
          </div>

          {reorderError && (
            <p className="forum-story-chapters__reorder-error" role="alert">{reorderError}</p>
          )}

          {chaptersLoading ? (
            <div className="forum-story-chapters__loading" aria-live="polite">
              <MoonLoading variant="inline" centered size={48} />
            </div>
          ) : chapters.length > 0 ? (
            <ol className="forum-story-chapters__list">
              {chapters.map((ch, index) => {
                const isBonus = !!ch.bonus;
                // Prefer the server's authoritative lock (covers 番外篇 comment gate);
                // fall back to the guest login gate for older payloads.
                const locked = ch.locked ?? !isGuestReadableChapter(ch.chapter_number, loggedIn);
                const lockReason = ch.lock_reason
                  || (locked ? (loggedIn ? 'comment' : 'login') : null);
                const isCommentLock = locked && loggedIn && lockReason === 'comment';
                const lockedLabel = isCommentLock
                  ? `${ch.display_title}（留言後可解鎖番外篇）`
                  : `${ch.display_title}（登入後可閱讀）`;
                return (
                <li key={ch.id || ch.chapter_number} className="forum-story-chapters__item">
                  <div className="forum-story-chapters__row">
                    <button
                      type="button"
                      className={`forum-story-chapters__link${locked ? ' forum-story-chapters__link--locked' : ''}${isBonus ? ' forum-story-chapters__link--bonus' : ''}`}
                      onClick={() => {
                        if (locked) {
                          if (isCommentLock) {
                            onScrollToComments?.();
                            return;
                          }
                          window.location.href = loginHref;
                          return;
                        }
                        onReadChapter(ch.chapter_number);
                      }}
                      aria-label={locked ? lockedLabel : ch.display_title}
                    >
                      <span className="forum-story-chapters__spine" aria-hidden="true" />
                      <span className="forum-story-chapters__num">{String(ch.chapter_number).padStart(2, '0')}</span>
                      <span className="forum-story-chapters__name-wrap">
                        <span className="forum-story-chapters__name">{ch.display_title}</span>
                        {isBonus && (
                          <span className="forum-story-chapters__bonus" title="番外篇 · 留言解鎖">番外</span>
                        )}
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
                      <div className="forum-story-chapters__author-actions">
                        {canReorder && (
                          <div className="forum-story-chapters__reorder" role="group" aria-label="調整章節順序">
                            <button
                              type="button"
                              className="forum-story-chapters__reorder-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveChapter(ch.id, 'up');
                              }}
                              disabled={reordering || index === 0}
                              aria-label={`上移 ${ch.display_title}`}
                              title="上移"
                            >
                              <span aria-hidden="true">↑</span>
                            </button>
                            <button
                              type="button"
                              className="forum-story-chapters__reorder-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveChapter(ch.id, 'down');
                              }}
                              disabled={reordering || index === chapters.length - 1}
                              aria-label={`下移 ${ch.display_title}`}
                              title="下移"
                            >
                              <span aria-hidden="true">↓</span>
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          className="forum-story-chapters__edit-btn"
                          onClick={() => openChapterEdit(ch)}
                          aria-label={`編輯 ${ch.display_title}`}
                        >
                          編輯
                        </button>
                      </div>
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
                <span className="forum-story-reader__enter-read-arrow" aria-hidden="true" />
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
