import { useEffect } from 'react';
import ForumMarkdownBody from './ForumMarkdownBody.js';
import { getChapterByNumber, chapterDisplayTitle } from '../lib/forum-story-chapters.js';
import { saveStoryReadingChapter } from '../lib/forum-story-reading-progress.js';
const READ_MODE = 'night';

export default function ForumStoryReadingView({
  post,
  chapters,
  chapterNumber,
  pollsById,
  loggedIn,
  accessToken,
  onPollVote,
  onExitRead,
  onGoChapter,
}) {
  const chapter = getChapterByNumber(chapters, chapterNumber) || chapters[0];
  const currentNum = chapter?.chapter_number || 1;
  const prevChapter = chapters.find((ch) => ch.chapter_number === currentNum - 1);
  const nextChapter = chapters.find((ch) => ch.chapter_number === currentNum + 1);
  const isLast = !nextChapter;

  useEffect(() => {
    if (post?.id && currentNum) {
      saveStoryReadingChapter(post.id, currentNum);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [post?.id, currentNum]);

  const totalChapters = chapters.length;
  const progressLabel = totalChapters > 0 ? `第 ${currentNum} / ${totalChapters} 章` : '';
  const chapterTitle = chapter.display_title || chapterDisplayTitle(chapter);
  const isGenericChapterTitle = /^第\s*\d+\s*章$/.test(String(chapterTitle).trim());
  const showChapterNav = totalChapters > 1;
  const showChapterHeading = showChapterNav || !isGenericChapterTitle;

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
    <article className={`forum-story-reading forum-story-reading--${READ_MODE}${showChapterNav ? '' : ' forum-story-reading--solo'}`}>
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
            <p className="forum-story-reading__book-title">{post.title || '無題'}</p>
            {showChapterHeading && (
              showChapterNav ? (
                <div className="forum-story-reading__chapter-row">
                  <button
                    type="button"
                    className="forum-story-reading__chapter-step forum-story-reading__chapter-step--prev"
                    disabled={!prevChapter}
                    onClick={() => prevChapter && onGoChapter(prevChapter.chapter_number)}
                    aria-label={
                      prevChapter
                        ? `上一章：${prevChapter.display_title || chapterDisplayTitle(prevChapter)}`
                        : '已是第一章'
                    }
                  >
                    <span className="forum-story-reading__chapter-step-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </span>
                  </button>
                  <h1 className="forum-story-reading__chapter-title">{chapterTitle}</h1>
                  <button
                    type="button"
                    className="forum-story-reading__chapter-step forum-story-reading__chapter-step--next"
                    disabled={!nextChapter}
                    onClick={() => nextChapter && onGoChapter(nextChapter.chapter_number)}
                    aria-label={
                      nextChapter
                        ? `下一章：${nextChapter.display_title || chapterDisplayTitle(nextChapter)}`
                        : '已是最後一章'
                    }
                  >
                    <span className="forum-story-reading__chapter-step-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </button>
                </div>
              ) : (
                <h1 className="forum-story-reading__chapter-title forum-story-reading__chapter-title--solo">{chapterTitle}</h1>
              )
            )}
          </div>
        </header>

        <div className={`forum-story-reader__page forum-story-reader__page--${READ_MODE} forum-story-reading__page`}>
          <ForumMarkdownBody
            content={chapter.content}
            className="forum-story-reader__body forum-md-body"
            storyMode
            pollsById={pollsById}
            loggedIn={loggedIn}
            accessToken={accessToken}
            onPollVote={onPollVote}
          />
        </div>
      </div>

      <footer className={`forum-story-reading__footer${isLast ? ' forum-story-reading__footer--last' : ''}`}>
        {isLast ? (
          <div className="forum-story-reading__closure">
            {prevChapter && (
              <button
                type="button"
                className="forum-story-reading__nav-btn forum-story-reading__nav-btn--prev"
                onClick={() => onGoChapter(prevChapter.chapter_number)}
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
              <span className="forum-story-reading__end-sigil" aria-hidden="true">🌙</span>
              <span className="forum-story-reading__end-text">暫無新章節</span>
              <span className="forum-story-reading__end-sub">感謝閱讀，靜候作者更新</span>
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
                onClick={() => onGoChapter(prevChapter.chapter_number)}
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
                onClick={() => onGoChapter(nextChapter.chapter_number)}
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
