import { useEffect } from 'react';
import Link from 'next/link';
import ForumMarkdownBody from './ForumMarkdownBody.js';
import { getChapterByNumber, chapterDisplayTitle, isGuestReadableChapter } from '../lib/forum-story-chapters.js';
import { saveStoryReadingChapter } from '../lib/forum-story-reading-progress.js';
const READ_MODE = 'night';

export default function ForumStoryReadingView({
  post,
  chapters,
  chapterNumber,
  pollsById,
  loggedIn,
  loginHref = '/login',
  accessToken,
  onPollVote,
  onExitRead,
  onGoChapter,
  onUnlockViaComment,
}) {
  const chapter = getChapterByNumber(chapters, chapterNumber) || chapters[0];
  const currentNum = chapter?.chapter_number || 1;
  const prevChapter = chapters.find((ch) => ch.chapter_number === currentNum - 1);
  const nextChapter = chapters.find((ch) => ch.chapter_number === currentNum + 1);
  const isLast = !nextChapter;
  // Server marks 番外篇 (comment-gated) chapters as locked; fall back to the
  // guest login gate for older payloads.
  const serverLocked = !!chapter?.locked;
  const lockReason = chapter?.lock_reason
    || (serverLocked ? (loggedIn ? 'comment' : 'login') : null);
  const isLocked = serverLocked || !isGuestReadableChapter(currentNum, loggedIn);
  const isCommentLock = isLocked && loggedIn && lockReason === 'comment';

  function goChapterIfAllowed(chNum) {
    const target = chapters.find((ch) => ch.chapter_number === chNum);
    // Only the guest login gate blocks navigation; comment-gated 番外篇 chapters
    // open and show the "留言解鎖" prompt in-place.
    if (!loggedIn && !isGuestReadableChapter(chNum, false) && !(target?.locked && loggedIn)) {
      window.location.href = loginHref;
      return;
    }
    onGoChapter(chNum);
  }

  useEffect(() => {
    if (post?.id && currentNum && !isLocked) {
      saveStoryReadingChapter(post.id, currentNum);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [post?.id, currentNum, isLocked]);

  const totalChapters = chapters.length;
  const progressLabel = totalChapters > 0 ? `第 ${currentNum} / ${totalChapters} 章` : '';
  const chapterTitle = chapter.display_title || chapterDisplayTitle(chapter);
  const isGenericChapterTitle = /^第\s*\d+\s*章$/.test(String(chapterTitle).trim());
  const showChapterNav = totalChapters > 1;
  const showChapterHeading = showChapterNav || !isGenericChapterTitle;
  const isFirstChapter = currentNum === 1;
  const isEdgeChapter = isFirstChapter || isLast;

  if (!chapter) {
    return (
      <div className="forum-story-reading forum-story-reading--empty">
        <p>找不到章節。</p>
        <button type="button" className="forum-story-reading__back" onClick={onExitRead}>
          返回書頁
        </button>
      </div>
    );
  }

  return (
    <article
      className={[
        'forum-story-reading',
        `forum-story-reading--${READ_MODE}`,
        showChapterNav ? '' : 'forum-story-reading--solo',
        isFirstChapter ? 'forum-story-reading--chapter-first' : '',
        isLast ? 'forum-story-reading--chapter-last' : '',
        isEdgeChapter ? 'forum-story-reading--chapter-edge' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="forum-story-reading__sheet">
        <header className="forum-story-reading__header">
          <div className="forum-story-reading__topbar">
            <button type="button" className="forum-story-reading__back" onClick={onExitRead}>
              <span className="forum-story-reading__back-icon" aria-hidden="true">←</span>
              返回書頁
            </button>
            {progressLabel && (
              <span className="forum-story-reading__progress">{progressLabel}</span>
            )}
          </div>

          {showChapterNav && (
            <div
              className="forum-story-reading__progress-track"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={totalChapters}
              aria-valuenow={currentNum}
              aria-label={`閱讀進度：${progressLabel}`}
            >
              <span
                className="forum-story-reading__progress-fill"
                style={{ width: `${(currentNum / totalChapters) * 100}%` }}
              />
            </div>
          )}

          <div className="forum-story-reading__meta">
            {!(isEdgeChapter && showChapterNav && showChapterHeading) && (
              <p className="forum-story-reading__book-title">{post.title || '無題'}</p>
            )}
            {showChapterHeading && (
              showChapterNav ? (
                <div
                  className={[
                    'forum-story-reading__chapter-row',
                    !prevChapter ? 'forum-story-reading__chapter-row--no-prev' : '',
                    !nextChapter ? 'forum-story-reading__chapter-row--no-next' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {prevChapter ? (
                    <button
                      type="button"
                      className="forum-story-reading__chapter-step forum-story-reading__chapter-step--prev"
                      onClick={() => goChapterIfAllowed(prevChapter.chapter_number)}
                      aria-label={`上一章：${prevChapter.display_title || chapterDisplayTitle(prevChapter)}`}
                    >
                      <span className="forum-story-reading__chapter-step-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    <span
                      className="forum-story-reading__chapter-step forum-story-reading__chapter-step--placeholder"
                      aria-hidden="true"
                    />
                  )}
                  <div className="forum-story-reading__chapter-heading">
                    {isEdgeChapter && (
                      <p className="forum-story-reading__book-title forum-story-reading__book-title--in-row">
                        {post.title || '無題'}
                      </p>
                    )}
                    <h1 className="forum-story-reading__chapter-title">{chapterTitle}</h1>
                  </div>
                  {nextChapter ? (
                    <button
                      type="button"
                      className="forum-story-reading__chapter-step forum-story-reading__chapter-step--next"
                      onClick={() => goChapterIfAllowed(nextChapter.chapter_number)}
                      aria-label={`下一章：${nextChapter.display_title || chapterDisplayTitle(nextChapter)}`}
                    >
                      <span className="forum-story-reading__chapter-step-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    <span
                      className="forum-story-reading__chapter-step forum-story-reading__chapter-step--placeholder"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ) : (
                <h1 className="forum-story-reading__chapter-title forum-story-reading__chapter-title--solo">{chapterTitle}</h1>
              )
            )}
          </div>
        </header>

        <div className={`forum-story-reader__page forum-story-reader__page--${READ_MODE} forum-story-reading__page`}>
          {isLocked ? (
            isCommentLock ? (
              <div className="forum-story-chapters__login-gate forum-story-reading__login-gate forum-story-chapters__login-gate--bonus">
                <span className="forum-story-chapters__login-icon" aria-hidden="true">🔒</span>
                <p className="forum-story-chapters__login-title">番外篇 · 留言解鎖</p>
                <p className="forum-story-chapters__login-text">在下方留言，即可解鎖這段番外篇內容。</p>
                <button
                  type="button"
                  className="forum-story-chapters__login-btn"
                  onClick={() => onUnlockViaComment?.()}
                >
                  去留言解鎖
                </button>
              </div>
            ) : (
              <div className="forum-story-chapters__login-gate forum-story-reading__login-gate">
                <span className="forum-story-chapters__login-icon" aria-hidden="true">🔒</span>
                <p className="forum-story-chapters__login-text">登入會員即可閱讀章節內容</p>
                <Link href={loginHref} className="forum-story-chapters__login-btn">
                  登入閱讀
                </Link>
              </div>
            )
          ) : (
            <ForumMarkdownBody
              content={chapter.content}
              className="forum-story-reader__body forum-md-body"
              storyMode
              pollsById={pollsById}
              loggedIn={loggedIn}
              accessToken={accessToken}
              onPollVote={onPollVote}
            />
          )}
        </div>
      </div>

      <footer className={`forum-story-reading__footer${isLast ? ' forum-story-reading__footer--last' : ''}`}>
        {isLast ? (
          <div className="forum-story-reading__closure">
            {prevChapter && (
              <button
                type="button"
                className="forum-story-reading__nav-btn forum-story-reading__nav-btn--prev"
                onClick={() => goChapterIfAllowed(prevChapter.chapter_number)}
              >
                <span className="forum-story-reading__nav-arrow" aria-hidden="true">‹</span>
                <span className="forum-story-reading__nav-copy">
                  <span className="forum-story-reading__nav-label">上一章</span>
                  <span className="forum-story-reading__nav-title">
                    {prevChapter.display_title || chapterDisplayTitle(prevChapter)}
                  </span>
                </span>
              </button>
            )}
            <div className="forum-story-reading__end">
              <span className="forum-story-reading__end-sigil" aria-hidden="true">{post.story_completed ? '🌕' : '🌙'}</span>
              <span className="forum-story-reading__end-text">{post.story_completed ? '已完結' : '暫無新章節'}</span>
              <span className="forum-story-reading__end-sub">
                {post.story_completed ? '感謝閱讀，故事到此圓滿' : '感謝閱讀，靜候作者更新'}
              </span>
            </div>
            <button type="button" className="forum-story-reading__finish-btn" onClick={onExitRead}>
              回到書頁
            </button>
          </div>
        ) : (
          <nav className="forum-story-reading__nav" aria-label="章節導覽">
            {prevChapter ? (
              <button
                type="button"
                className="forum-story-reading__nav-btn forum-story-reading__nav-btn--prev"
                onClick={() => goChapterIfAllowed(prevChapter.chapter_number)}
              >
                <span className="forum-story-reading__nav-arrow" aria-hidden="true">‹</span>
                <span className="forum-story-reading__nav-copy">
                  <span className="forum-story-reading__nav-label">上一章</span>
                  <span className="forum-story-reading__nav-title">
                    {prevChapter.display_title || chapterDisplayTitle(prevChapter)}
                  </span>
                </span>
              </button>
            ) : (
              <span className="forum-story-reading__nav-placeholder" aria-hidden="true" />
            )}

            {nextChapter && (
              <button
                type="button"
                className="forum-story-reading__nav-btn forum-story-reading__nav-btn--next"
                onClick={() => goChapterIfAllowed(nextChapter.chapter_number)}
              >
                <span className="forum-story-reading__nav-copy">
                  <span className="forum-story-reading__nav-label">下一章</span>
                  <span className="forum-story-reading__nav-title">
                    {nextChapter.display_title || chapterDisplayTitle(nextChapter)}
                  </span>
                </span>
                <span className="forum-story-reading__nav-arrow-wrap" aria-hidden="true">
                  <span className="forum-story-reading__nav-arrow">›</span>
                </span>
              </button>
            )}
          </nav>
        )}
      </footer>
    </article>
  );
}
