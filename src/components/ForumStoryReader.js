import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getStoryReadingChapter,
  readStoryReadingResume,
} from '../lib/forum-story-reading-progress.js';
import { GUEST_FREE_CHAPTER_COUNT, isGuestReadableChapter } from '../lib/forum-story-chapters.js';
import { recordStoryView } from '../lib/forum-story-views.js';
import ForumStoryBookHub from './ForumStoryBookHub.js';
import ForumStoryReadingView from './ForumStoryReadingView.js';
import MoonLoading from './MoonLoading.js';

export default function ForumStoryReader({
  post,
  chapters: chaptersProp,
  chapterCount,
  chaptersLoading: chaptersLoadingProp,
  pollsById,
  loggedIn,
  loginHref = '/login',
  accessToken,
  onPollVote,
  onLike,
  onBookmark,
  onScrollToComments,
  onChaptersChange,
  onPostUpdate,
  likingPost,
  bookmarking,
  reportButton,
  reportNotice,
}) {
  const router = useRouter();
  const reading = router.query.read === '1';
  const chapterNumber = Math.max(1, parseInt(router.query.ch, 10) || 1);
  const clientMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const chapters = useMemo(() => {
    if (Array.isArray(chaptersProp)) return chaptersProp;
    return null;
  }, [chaptersProp]);

  const chaptersLoading = chaptersLoadingProp ?? chapters == null;

  const { resumeChapterNumber, hasReadingProgress } = useMemo(() => {
    if (!clientMounted || !post?.id || chaptersLoading || !chapters?.length) {
      return { resumeChapterNumber: 1, hasReadingProgress: false };
    }
    const resume = readStoryReadingResume(post.id, chapters);
    const chapterNumber = loggedIn
      ? resume.chapterNumber
      : Math.min(resume.chapterNumber, GUEST_FREE_CHAPTER_COUNT);
    return {
      resumeChapterNumber: chapterNumber,
      hasReadingProgress: loggedIn ? resume.hasProgress : resume.hasProgress && resume.chapterNumber <= GUEST_FREE_CHAPTER_COUNT,
    };
  }, [clientMounted, post?.id, chapters, chaptersLoading, reading, loggedIn]);

  const goRead = useCallback((chNum) => {
    if (!chapters?.length) return;
    const fallback = getStoryReadingChapter(post.id, chapters);
    const requested = chNum ?? (
      loggedIn ? fallback : Math.min(fallback, GUEST_FREE_CHAPTER_COUNT)
    );
    if (!loggedIn && !isGuestReadableChapter(requested, false)) {
      router.push(loginHref);
      return;
    }
    router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, read: '1', ch: String(requested) },
      },
      undefined,
      { shallow: true },
    );
  }, [router, post.id, chapters, loggedIn, loginHref]);

  const exitRead = useCallback(() => {
    const { read: _r, ch: _c, ...rest } = router.query;
    router.push({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
  }, [router]);

  useEffect(() => {
    if (!post?.id) return undefined;
    let cancelled = false;
    recordStoryView(post.id, accessToken).then((viewCount) => {
      if (!cancelled && viewCount != null) {
        onPostUpdate?.({ view_count: viewCount });
      }
    });
    return () => { cancelled = true; };
  }, [post?.id, accessToken, onPostUpdate]);

  if (reading) {
    if (chaptersLoading) {
      return (
        <div className="forum-story-reading forum-story-reading--loading">
          <MoonLoading variant="inline" centered size={48} />
        </div>
      );
    }
    return (
      <ForumStoryReadingView
        post={post}
        chapters={chapters}
        chapterNumber={chapterNumber}
        pollsById={pollsById}
        loggedIn={loggedIn}
        loginHref={loginHref}
        accessToken={accessToken}
        onPollVote={onPollVote}
        onExitRead={exitRead}
        onGoChapter={goRead}
      />
    );
  }

  return (
    <ForumStoryBookHub
      post={post}
      chapters={chapters || []}
      chaptersLoading={chaptersLoading}
      chapterCount={chapterCount}
      loggedIn={loggedIn}
      loginHref={loginHref}
      resumeChapterNumber={resumeChapterNumber}
      hasReadingProgress={hasReadingProgress}
      readingResumeReady={clientMounted}
      accessToken={accessToken}
      onEnterRead={goRead}
      onReadChapter={goRead}
      onChaptersChange={onChaptersChange}
      onPostUpdate={onPostUpdate}
      onLike={onLike}
      onBookmark={onBookmark}
      onScrollToComments={onScrollToComments}
      likingPost={likingPost}
      bookmarking={bookmarking}
      reportButton={reportButton}
      reportNotice={reportNotice}
    />
  );
}
