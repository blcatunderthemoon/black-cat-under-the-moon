import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getStoryReadingChapter,
  readStoryReadingResume,
} from '../lib/forum-story-reading-progress.js';
import { recordStoryView } from '../lib/forum-story-views.js';
import ForumStoryBookHub from './ForumStoryBookHub.js';
import ForumStoryReadingView from './ForumStoryReadingView.js';

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

  const chaptersLoading = chaptersLoadingProp ?? (loggedIn && chapters === null);

  const { resumeChapterNumber, hasReadingProgress } = useMemo(() => {
    if (!clientMounted || !post?.id || chaptersLoading || !chapters?.length) {
      return { resumeChapterNumber: 1, hasReadingProgress: false };
    }
    const resume = readStoryReadingResume(post.id, chapters);
    return {
      resumeChapterNumber: resume.chapterNumber,
      hasReadingProgress: resume.hasProgress,
    };
  }, [clientMounted, post?.id, chapters, chaptersLoading, reading]);

  const goRead = useCallback((chNum) => {
    if (!loggedIn) {
      router.push(loginHref);
      return;
    }
    if (!chapters?.length) return;
    const target = chNum ?? getStoryReadingChapter(post.id, chapters);
    router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, read: '1', ch: String(target) },
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
    if (reading && !loggedIn) {
      router.replace(loginHref);
    }
  }, [reading, loggedIn, loginHref, router]);

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
    if (!loggedIn) {
      return (
        <div className="forum-story-reading forum-story-reading--loading">
          <p className="forum-story-reading__loading">請先登入…</p>
        </div>
      );
    }
    if (chaptersLoading) {
      return (
        <div className="forum-story-reading forum-story-reading--loading">
          <p className="forum-story-reading__loading">載入章節…</p>
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
