/**
 * /forum/[postId] — Post detail + comments
 */

import { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context.js';
import AppShell from '../../components/AppShell.js';
import ForumHeaderAuth from '../../components/ForumHeaderAuth.js';
import ForumBookmarksPanel from '../../components/ForumBookmarksPanel.js';
import { FORUM_DISPLAY_NAME, forumTopicLabel } from '../../lib/forum-welcome.js';
import SeoHead from '../../components/SeoHead.js';
import ForumPostTags from '../../components/ForumPostTags.js';
import ForumAuthorName from '../../components/ForumAuthorName.js';
import ForumCommentField from '../../components/ForumCommentField.js';
import ForumMarkdownBody from '../../components/ForumMarkdownBody.js';
import ForumSectionErrorBoundary from '../../components/ForumSectionErrorBoundary.js';
import ForumModToolbar from '../../components/ForumModToolbar.js';
import ForumStoryReader from '../../components/ForumStoryReader.js';
import { isStoryPost } from '../../lib/forum-story.js';
import {
  clearForumDraft,
  forumCommentDraftKey,
} from '../../lib/forum-draft-storage.js';
import MoonLoading from '../../components/MoonLoading.js';
import ForumMatureGate from '../../components/ForumMatureGate.js';
import {
  isMatureForumTopicStored,
  resolveMatureGateAck,
  fetchMatureGateAck,
  MATURE_FORUM_TOPIC,
} from '../../lib/forum-mature.js';
import { readStoredAuthSession } from '../../lib/browser-session.js';
import {
  readForumPostBootstrap,
  writeForumPostCache,
} from '../../lib/forum-post-cache.js';
import { absoluteUrl } from '../../lib/site-seo.js';

function mergeStoryPostFields(prevPost, nextPost) {
  if (!prevPost || !nextPost) return nextPost || prevPost;
  const merged = { ...prevPost, ...nextPost };
  if (nextPost.cover_image_url === undefined && prevPost.cover_image_url) {
    merged.cover_image_url = prevPost.cover_image_url;
  }
  if (nextPost.synopsis === undefined && prevPost.synopsis) {
    merged.synopsis = prevPost.synopsis;
  }
  if (nextPost.view_count === undefined && prevPost.view_count != null) {
    merged.view_count = prevPost.view_count;
  }
  if (nextPost.story_completed === undefined && prevPost.story_completed != null) {
    merged.story_completed = prevPost.story_completed;
  }
  return merged;
}

function resolveStoryChapters(payload, chaptersPayload, prev) {
  if (Array.isArray(payload?.chapters)) return payload.chapters;
  if (chaptersPayload && Array.isArray(chaptersPayload.chapters)) return chaptersPayload.chapters;
  if (chaptersPayload && isStoryPost(payload?.post)) return [];
  if (prev?.chapters) return prev.chapters;
  return undefined;
}

function mergePostDetailPayload(prev, payload, chaptersPayload) {
  if (!payload?.post) return prev || payload;

  const chapters = resolveStoryChapters(payload, chaptersPayload, prev);
  const comments = Array.isArray(payload.comments) ? payload.comments : (prev?.comments ?? []);

  if (!prev?.post) {
    return {
      ...payload,
      chapters,
      comments,
      _bootstrap: false,
    };
  }

  return {
    ...prev,
    ...payload,
    post: mergeStoryPostFields(prev.post, payload.post),
    chapters,
    comments,
    polls: payload.polls ?? prev.polls,
    tag_labels: { ...(prev.tag_labels || {}), ...(payload.tag_labels || {}) },
    _bootstrap: false,
  };
}

async function fetchPostDetailBundle(postId, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const postPromise = fetch(`/api/forum/posts/${encodeURIComponent(postId)}`, { headers })
    .then(async (r) => {
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(payload.error || 'Load failed');
        err.code = payload.code || '';
        err.status = r.status;
        throw err;
      }
      return payload;
    });

  const chaptersPromise = token
    ? fetch(`/api/forum/posts/${encodeURIComponent(postId)}/chapters`, { headers })
      .then(async (r) => (r.ok ? r.json().catch(() => null) : null))
      .catch(() => null)
    : Promise.resolve(null);

  const [payload, chaptersPayload] = await Promise.all([postPromise, chaptersPromise]);
  return { payload, chaptersPayload };
}

/**
 * A transient failure (network drop, cold start, 5xx/timeout) is worth retrying —
 * unlike a real 404 or an auth/members gate (which carry a `code` or a 4xx status).
 */
function isTransientLoadError(err) {
  if (!err || err.code) return false;
  const status = err.status;
  return status == null || status === 408 || status === 429 || status >= 500;
}

function AuthorLinks({ author, isMine }) {
  return (
    <ForumAuthorName
      name={author?.display_name}
      isMine={isMine}
      isPremium={author?.is_premium}
      mirrorSlug={author?.mirror_slug}
    />
  );
}

function ForumReportConfirmOverlay({ open, title, sub, onConfirm, onCancel, confirming }) {
  if (!open) return null;
  return (
    <div className="forum-report-overlay show" role="dialog" aria-modal="true" aria-labelledby="forum-report-confirm-title">
      <div className="forum-report-overlay__box">
        <span className="forum-report-overlay__icon" aria-hidden="true">⚑</span>
        <div className="forum-report-overlay__title" id="forum-report-confirm-title">{title}</div>
        <div className="forum-report-overlay__sub">{sub}</div>
        <button type="button" className="forum-report-overlay__confirm" onClick={onConfirm} disabled={confirming}>
          {confirming ? '提交中…' : '確認檢舉'}
        </button>
        <button type="button" className="forum-report-overlay__cancel" onClick={onCancel} disabled={confirming}>
          取消
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-HK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function normalizeRouteId(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function seoExcerpt(text, max = 150) {
  if (!text) return '';
  const flat = String(text).replace(/[#*>`\[\]()]/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function buildPostJsonLd(seo) {
  if (!seo?.indexable) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: seo.title,
    text: seo.excerpt || seo.title,
    url: absoluteUrl(`/forum/${seo.id}`),
    datePublished: seo.created_at || undefined,
    inLanguage: 'zh-Hant',
    author: { '@type': 'Person', name: seo.author_name || '月下貓' },
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: seo.like_count || 0,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: seo.comment_count || 0,
      },
    ],
    isPartOf: {
      '@type': 'WebSite',
      name: 'Black Cat Under The Moon',
      url: absoluteUrl('/forum'),
    },
  };
}

export default function ForumPostPage({ seo = null }) {
  const { session, profile, displayName, refreshProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const postId = normalizeRouteId(router.query.postId);
  const commentsRef = useRef(null);

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadErrorCode, setLoadErrorCode] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [bookmarking, setBookmarking] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [reportPending, setReportPending] = useState(null);
  const [reportConfirming, setReportConfirming] = useState(false);
  const [reportedKeys, setReportedKeys] = useState(() => new Set());
  const [reportNotice, setReportNotice] = useState('');
  const [likingCommentId, setLikingCommentId] = useState(null);
  const [likingPost, setLikingPost] = useState(false);
  const [opOnly, setOpOnly] = useState(false);
  const [matureAcked, setMatureAcked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadedTokenRef = useRef(undefined);
  const loadSeqRef = useRef(0);

  const redirectPath = postId ? `/forum/${postId}` : '/forum';
  const breadcrumbs = [
    { href: '/forum', label: `🌙 ${FORUM_DISPLAY_NAME}` },
    { label: '貼文詳情' },
  ];

  const reloadPost = useCallback(async () => {
    if (!postId) return;
    const token = session?.access_token ?? readStoredAuthSession()?.access_token ?? null;
    try {
      const { payload, chaptersPayload } = await fetchPostDetailBundle(postId, token);
      setLoadError(null);
      setLoadErrorCode('');
      setData((prev) => {
        const next = mergePostDetailPayload(prev, payload, chaptersPayload);
        writeForumPostCache(postId, next);
        return next;
      });
    } catch {
      /* keep current view on soft refresh failure */
    }
  }, [postId, session?.access_token]);

  const retryLoad = useCallback(() => {
    loadedTokenRef.current = undefined;
    setLoadError(null);
    setLoadErrorCode('');
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!postId) return;
    loadedTokenRef.current = undefined;
    const bootstrap = readForumPostBootstrap(postId);
    setData(bootstrap ?? null);
    setLoadError(null);
    setLoadErrorCode('');
  }, [postId]);

  useEffect(() => {
    if (!router.isReady || !postId) return undefined;

    const stored = readStoredAuthSession();
    const token = session?.access_token ?? stored?.access_token ?? null;
    if (loadedTokenRef.current === token) {
      return undefined;
    }

    const seq = ++loadSeqRef.current;
    let cancelled = false;
    let retryTimer = null;

    const runAttempt = (triesLeft) => {
      fetchPostDetailBundle(postId, token)
        .then(({ payload, chaptersPayload }) => {
          if (cancelled || seq !== loadSeqRef.current) return;
          setLoadError(null);
          setLoadErrorCode('');
          setData((prev) => {
            const next = mergePostDetailPayload(prev, payload, chaptersPayload);
            writeForumPostCache(postId, next);
            return next;
          });
          loadedTokenRef.current = token;
        })
        .catch((e) => {
          if (cancelled || seq !== loadSeqRef.current) return;
          // Retry transient failures (cold start, network blip, 5xx) before giving up.
          if (isTransientLoadError(e) && triesLeft > 0) {
            const delay = 500 * (3 - triesLeft);
            retryTimer = setTimeout(() => {
              if (!cancelled && seq === loadSeqRef.current) runAttempt(triesLeft - 1);
            }, delay);
            return;
          }
          // Something is already on screen (feed/session cache) — keep it rather than
          // replacing a readable post with a full-page error.
          if (readForumPostBootstrap(postId)) return;
          setLoadError(e.message);
          setLoadErrorCode(e.code || (isTransientLoadError(e) ? 'network' : ''));
        });
    };

    runAttempt(2);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [postId, router.isReady, session?.access_token, reloadKey]);

  useEffect(() => {
    const userId = session?.user?.id;
    const serverMatureAck = !!profile?.profile?.forum_mature_acknowledged;
    if (!userId) {
      setMatureAcked(false);
      return undefined;
    }

    const localOrProfile = resolveMatureGateAck(userId, serverMatureAck);
    setMatureAcked(localOrProfile);
    if (localOrProfile || !session?.access_token) return undefined;

    let cancelled = false;
    fetchMatureGateAck(session.access_token, userId).then((acked) => {
      if (!cancelled) setMatureAcked(acked);
    });
    return () => { cancelled = true; };
  }, [postId, session?.user?.id, session?.access_token, profile?.profile?.forum_mature_acknowledged]);

  useEffect(() => {
    if (!postId) return undefined;
    return () => {
      clearForumDraft(forumCommentDraftKey(postId));
    };
  }, [postId]);

  async function handleComment(e) {
    e.preventDefault();
    const content = comment.trim();
    if (!content || submitting) return;

    const optimisticId = `pending-${Date.now()}`;
    const optimisticComment = {
      id: optimisticId,
      content,
      created_at: new Date().toISOString(),
      like_count: 0,
      viewer_liked: false,
      author: { display_name: displayName || profile?.profile?.display_name || '我' },
      is_mine: true,
      is_op: !!(data?.post && (data.post.is_mine || data.post.author_id === session?.user?.id)),
      _pending: true,
    };

    setSubmitting(true);
    setCommentError('');
    setComment('');
    clearForumDraft(forumCommentDraftKey(postId));
    setData((d) => {
      if (!d) return d;
      const nextComments = [...(d.comments || []), optimisticComment];
      return {
        ...d,
        comments: nextComments,
        post: {
          ...d.post,
          comment_count: (d.post?.comment_count || d.comments?.length || 0) + 1,
        },
      };
    });
    requestAnimationFrame(() => {
      commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });

    try {
      const r = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content }),
      });
      const result = await r.json();
      if (!r.ok) {
        setData((d) => {
          if (!d) return d;
          const nextComments = (d.comments || []).filter((c) => c.id !== optimisticId);
          return {
            ...d,
            comments: nextComments,
            post: {
              ...d.post,
              comment_count: Math.max(0, (d.post?.comment_count || nextComments.length + 1) - 1),
            },
          };
        });
        setComment(content);
        setCommentError(result.error || '留言失敗。');
        return;
      }
      let hadLockedBonus = false;
      setData((d) => {
        if (!d) return d;
        hadLockedBonus = (d.chapters || []).some((c) => c.bonus && c.locked);
        const nextComments = (d.comments || []).map((c) => (
          c.id === optimisticId ? { ...result.comment, _pending: false } : c
        ));
        return {
          ...d,
          comments: nextComments,
          post: {
            ...d.post,
            comment_count: result.comment_count ?? nextComments.length,
          },
        };
      });
      // 留言後解鎖番外篇：重新載入以取回已解鎖的章節內容。
      if (hadLockedBonus) reloadPost();
    } catch {
      setData((d) => {
        if (!d) return d;
        const nextComments = (d.comments || []).filter((c) => c.id !== optimisticId);
        return {
          ...d,
          comments: nextComments,
          post: {
            ...d.post,
            comment_count: Math.max(0, (d.post?.comment_count || nextComments.length + 1) - 1),
          },
        };
      });
      setComment(content);
      setCommentError('留言失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  function openReportConfirm(type, id) {
    if (!session) { router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`); return; }
    const key = `${type}:${id}`;
    if (reportedKeys.has(key)) return;
    setReportPending({
      type,
      id,
      title: type === 'comment' ? '確認檢舉留言？' : '確認檢舉？',
      sub: type === 'comment'
        ? '確認後，我哋會審核呢條留言。感謝你維護社區安全 🙏'
        : '確認後，我哋會審核呢條內容。感謝你維護社區安全 🙏',
    });
  }

  function closeReportConfirm() {
    if (reportConfirming) return;
    setReportPending(null);
  }

  async function confirmReport() {
    if (!reportPending || reportConfirming) return;
    const { type, id } = reportPending;
    const key = `${type}:${id}`;
    setReportConfirming(true);
    try {
      const r = await fetch('/api/forum/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ target_type: type, target_id: id }),
      });
      if (r.ok) {
        setReportedKeys((prev) => new Set(prev).add(key));
        setReportNotice('已提交檢舉，感謝你的回報。');
        setTimeout(() => setReportNotice(''), 4000);
      } else {
        const result = await r.json().catch(() => ({}));
        setReportNotice(result.error || '檢舉失敗，請稍後再試。');
        setTimeout(() => setReportNotice(''), 4000);
      }
    } catch {
      setReportNotice('網路錯誤，請稍後再試。');
      setTimeout(() => setReportNotice(''), 4000);
    } finally {
      setReportConfirming(false);
      setReportPending(null);
    }
  }

  function updateCommentLike(commentId, patch) {
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        comments: (d.comments || []).map((c) => (
          c.id === commentId ? { ...c, ...patch } : c
        )),
      };
    });
  }

  async function handleCommentLike(commentId) {
    if (!session) { router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`); return; }
    const target = data?.comments?.find((c) => c.id === commentId);
    if (!target || target.viewer_liked || target.is_mine || likingCommentId === commentId) return;

    const prevLiked = !!target.viewer_liked;
    const prevCount = target.like_count || 0;

    updateCommentLike(commentId, {
      viewer_liked: true,
      like_count: prevCount + 1,
    });
    setLikingCommentId(commentId);

    try {
      const r = await fetch(`/api/forum/comments/${encodeURIComponent(commentId)}?action=like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await r.json().catch(() => ({}));

      if (r.status === 409) {
        updateCommentLike(commentId, {
          viewer_liked: true,
          like_count: result.like_count ?? prevCount + 1,
        });
        return;
      }

      if (!r.ok) {
        updateCommentLike(commentId, {
          viewer_liked: prevLiked,
          like_count: prevCount,
        });
        setReportNotice(result.error || '讚好失敗，請稍後再試。');
        setTimeout(() => setReportNotice(''), 4000);
        return;
      }

      updateCommentLike(commentId, {
        viewer_liked: true,
        like_count: result.like_count ?? prevCount + 1,
      });
    } catch {
      updateCommentLike(commentId, {
        viewer_liked: prevLiked,
        like_count: prevCount,
      });
      setReportNotice('網路錯誤，請稍後再試。');
      setTimeout(() => setReportNotice(''), 4000);
    } finally {
      setLikingCommentId(null);
    }
  }

  async function handleLike() {
    if (!session) {
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }
    if (data?.post?.viewer_liked || likingPost) return;

    const prevLiked = !!data?.post?.viewer_liked;
    const prevCount = data?.post?.like_count || 0;
    setLikingPost(true);
    setData((d) => d ? {
      ...d,
      post: {
        ...d.post,
        viewer_liked: true,
        like_count: prevCount + 1,
      },
    } : d);

    try {
      const r = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}?action=like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await r.json().catch(() => ({}));
      if (r.status === 409) {
        setData((d) => d ? {
          ...d,
          post: {
            ...d.post,
            viewer_liked: true,
            like_count: result.like_count ?? d.post.like_count,
          },
        } : d);
        return;
      }
      if (!r.ok) {
        setData((d) => d ? {
          ...d,
          post: {
            ...d.post,
            viewer_liked: prevLiked,
            like_count: prevCount,
          },
        } : d);
        setReportNotice(result.error || '讚好失敗，請稍後再試。');
        setTimeout(() => setReportNotice(''), 4000);
        return;
      }
      setData((d) => d ? {
        ...d,
        post: {
          ...d.post,
          viewer_liked: true,
          like_count: result.like_count ?? prevCount + 1,
        },
      } : d);
    } catch {
      setData((d) => d ? {
        ...d,
        post: {
          ...d.post,
          viewer_liked: prevLiked,
          like_count: prevCount,
        },
      } : d);
      setReportNotice('網路錯誤，請稍後再試。');
      setTimeout(() => setReportNotice(''), 4000);
    } finally {
      setLikingPost(false);
    }
  }

  async function handleBookmark() {
    if (!session) { router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`); return; }
    if (bookmarking) return;
    setBookmarking(true);
    try {
      const r = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}?action=bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(result.error || '收藏失敗，請稍後再試。');
        return;
      }
      setData((d) => d ? {
        ...d,
        post: {
          ...d.post,
          viewer_bookmarked: !!result.bookmarked,
        },
      } : d);
    } catch {
      alert('網路錯誤，請重試。');
    } finally {
      setBookmarking(false);
    }
  }

  function handleBookmarkChange(changedPostId, bookmarked) {
    setData((d) => {
      if (!d?.post || d.post.id !== changedPostId) return d;
      return {
        ...d,
        post: { ...d.post, viewer_bookmarked: bookmarked },
      };
    });
  }

  function scrollToComments() {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const post = data?.post;
  const storyChapters = data?.chapters;
  const isStoryReading = !!(post && isStoryPost(post) && router.query.read === '1');
  const isStoryBook = !!(post && isStoryPost(post) && !isStoryReading);

  const shellProps = {
    headerVariant: 'forum',
    pageClassName: `app-page--forum app-page--forum-post${isStoryReading ? ' app-page--forum-story-reading' : ''}`,
    warmBackground: true,
    showStarfield: false,
    breadcrumbs,
    nav: (
      <ForumHeaderAuth
        redirectPath={redirectPath}
        onBookmarksClick={() => setShowBookmarks(true)}
      />
    ),
  };

  const pollsById = useMemo(() => {
    const map = {};
    for (const poll of data?.polls || []) {
      map[poll.id] = poll;
    }
    return map;
  }, [data?.polls]);

  const handlePollVote = useCallback((pollId, updated) => {
    setData((prev) => {
      if (!prev?.polls) return prev;
      return {
        ...prev,
        polls: prev.polls.map((p) => (p.id === pollId ? { ...p, ...updated } : p)),
      };
    });
  }, []);

  const comments = data?.comments || [];
  const commentsBootstrapping = !!data?._bootstrap;
  const visibleComments = useMemo(() => {
    if (!opOnly) return comments;
    return comments.filter((c) => c.is_op);
  }, [comments, opOnly]);
  const hasNonOpComments = useMemo(
    () => comments.some((c) => !c.is_op),
    [comments],
  );

  const storedAccessToken = useSyncExternalStore(
    () => () => {},
    () => readStoredAuthSession()?.access_token ?? null,
    () => null,
  );
  const accessToken = session?.access_token ?? storedAccessToken;

  const storyDetailReady = !isStoryBook || (
    !commentsBootstrapping
    && Array.isArray(storyChapters)
  );
  const storyDetailLoading = isStoryBook && !storyDetailReady;

  const handleChaptersChange = useCallback((updatedChapters) => {
    if (!Array.isArray(updatedChapters)) return;
    setData((d) => {
      if (!d) return d;
      const next = { ...d, chapters: updatedChapters };
      if (postId) writeForumPostCache(postId, next);
      return next;
    });
  }, [postId]);

  const handlePostUpdate = useCallback((patch) => {
    setData((d) => {
      if (!d?.post) return d;
      const cleaned = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      const next = {
        ...d,
        post: mergeStoryPostFields(d.post, { ...d.post, ...cleaned }),
      };
      if (postId) writeForumPostCache(postId, next);
      return next;
    });
  }, [postId]);

  if (loadError) {
    const isMatureLoginRequired = loadErrorCode === 'mature_login_required';
    const isMembersOnly = !isMatureLoginRequired && (
      loadErrorCode === 'members_only'
      || loadError === 'Login required to view this post'
    );
    return (
      <>
        <SeoHead
          title={seo?.title || '貼文'}
          description={seo?.excerpt || `${FORUM_DISPLAY_NAME} — 貼文`}
          path={`/forum/${postId}`}
          noindex={isMembersOnly || isMatureLoginRequired || seo?.indexable === false}
        />
        <AppShell {...shellProps}>
          <div className={`pixel-empty${(isMembersOnly || isMatureLoginRequired) ? ' forum-members-gate' : ''}`}>
            {isMatureLoginRequired ? (
              <>
                <span className="forum-members-gate__icon" aria-hidden="true">🌙</span>
                <h2 className="forum-members-gate__title">{MATURE_FORUM_TOPIC}</h2>
                <p className="pixel-subtitle forum-members-gate__text">
                  此貼文屬於成熟話題版塊，僅供已登入會員閱讀。請先登入並確認年齡。
                </p>
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
                  className="pixel-btn pixel-btn--primary forum-members-gate__cta"
                >
                  登入後繼續
                </Link>
              </>
            ) : isMembersOnly ? (
              <>
                <span className="forum-members-gate__icon" aria-hidden="true">🔒</span>
                <h2 className="forum-members-gate__title">會員限定內容</h2>
                <p className="pixel-subtitle forum-members-gate__text">
                  這篇貼文只供已登入會員閱讀。登入後即可查看全文與留言。
                </p>
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
                  className="pixel-btn pixel-btn--primary forum-members-gate__cta"
                >
                  登入查看
                </Link>
              </>
            ) : loadErrorCode === 'network' ? (
              <>
                <p className="pixel-subtitle">貼文載入失敗，請檢查網絡後再試。</p>
                <button
                  type="button"
                  className="pixel-btn pixel-btn--primary forum-members-gate__cta"
                  onClick={retryLoad}
                >
                  重新載入
                </button>
                <Link href="/forum" className="pixel-link">← 返回{FORUM_DISPLAY_NAME}</Link>
              </>
            ) : (
              <>
                <p className="pixel-subtitle">找不到這篇貼文。</p>
                <Link href="/forum" className="pixel-link">← 返回{FORUM_DISPLAY_NAME}</Link>
              </>
            )}
          </div>
        </AppShell>
        {showBookmarks && (
          <ForumBookmarksPanel
            open={showBookmarks}
            onClose={() => setShowBookmarks(false)}
            accessToken={session?.access_token}
            onBookmarkChange={handleBookmarkChange}
          />
        )}
      </>
    );
  }

  const needsMatureAck = post && isMatureForumTopicStored(post.topic) && !matureAcked;
  const commentCount = comments.length || post?.comment_count || 0;

  if (needsMatureAck) {
    return (
      <>
        <SeoHead
          title={MATURE_FORUM_TOPIC}
          description={`${FORUM_DISPLAY_NAME} — 成熟話題`}
          path={`/forum/${postId}`}
          noindex
        />
        <AppShell {...shellProps}>
          <div className="forum-mature-backdrop-placeholder" aria-hidden="true" />
        </AppShell>
        <ForumMatureGate
          open
          session={session}
          loginRedirect={redirectPath}
          onAcknowledged={() => {
            setMatureAcked(true);
            refreshProfile?.({ force: true });
          }}
          onDismiss={() => router.push('/forum')}
        />
      </>
    );
  }

  return (
    <>
      <SeoHead
        title={post?.title || seo?.title || '貼文'}
        description={
          post?.content
            ? `${post.content.slice(0, 120).replace(/\s+/g, ' ').trim()}…`
            : seo?.excerpt || `${FORUM_DISPLAY_NAME} 貼文 — Black Cat Under The Moon 月光圍爐`
        }
        path={postId ? `/forum/${postId}` : '/forum'}
        ogType="article"
        noindex={post?.visibility === 'members_only' || seo?.indexable === false}
        jsonLd={buildPostJsonLd(seo)}
      />
      <AppShell {...shellProps}>
        {!post ? (
          <MoonLoading variant="hero" />
        ) : (
          <ForumSectionErrorBoundary fallbackLabel="貼文">
          <>
            <div className={`forum-post-detail-stack${isStoryReading ? ' forum-post-detail-stack--story-reading' : ''}`}>
              {post.viewer_can_moderate && session?.access_token && !isStoryReading && (
                <ForumModToolbar
                  post={post}
                  accessToken={session.access_token}
                  onUpdated={reloadPost}
                  className="forum-mod-toolbar--above-card"
                />
              )}
            <article className={isStoryPost(post)
              ? 'forum-story-reader-shell'
              : `pixel-card forum-post-card${post.is_highlighted ? ' forum-post-card--crowned' : (post.is_pinned ? ' forum-post-card--pinned' : '')}`}>
              {isStoryPost(post) ? (
                <ForumStoryReader
                  post={post}
                  chapters={storyChapters}
                  chapterCount={data?.chapter_count}
                  chaptersLoading={storyDetailLoading}
                  pollsById={pollsById}
                  loggedIn={!!accessToken}
                  loginHref={`/login?redirect=${encodeURIComponent(router.asPath)}`}
                  accessToken={accessToken}
                  onPollVote={handlePollVote}
                  onLike={handleLike}
                  onBookmark={handleBookmark}
                  onScrollToComments={scrollToComments}
                  onChaptersChange={handleChaptersChange}
                  onPostUpdate={handlePostUpdate}
                  likingPost={likingPost}
                  bookmarking={bookmarking}
                  reportNotice={reportNotice}
                  reportButton={session && !post.is_mine ? (
                    <button
                      type="button"
                      className="forum-btn-report-inline forum-story-reader__report"
                      disabled={reportedKeys.has(`post:${post.id}`)}
                      onClick={() => openReportConfirm('post', post.id)}
                      title="檢舉"
                      aria-label="檢舉"
                    >
                      {reportedKeys.has(`post:${post.id}`) ? '已檢舉' : '⚑'}
                    </button>
                  ) : null}
                />
              ) : (
              <>
              <div className="forum-post-card__tag-row">
                <div className="forum-post-card__tags">
                  <span className="pixel-tag" style={{ color: 'var(--purple-light)' }}>{forumTopicLabel(post.topic)}</span>
                  <ForumPostTags tags={post.tags} tagLabels={data?.tag_labels} variant="detail" />
                  {post.visibility === 'members_only' && (
                    <span className="forum-visibility-badge">🔒 會員限定</span>
                  )}
                  {post.hide_username && (
                    <span className="forum-visibility-badge">🎭 匿名</span>
                  )}
                  {post.is_hidden && (
                    <span className="forum-visibility-badge">🌑 夜幕降臨</span>
                  )}
                  {post.is_pinned && (
                    <span className="forum-visibility-badge">📌 圍爐置頂</span>
                  )}
                  {post.is_highlighted && (
                    <span className="forum-crown-badge" aria-label="月光加冕">
                      <span className="forum-crown-badge__sigil" aria-hidden="true">✨</span>
                      <span className="forum-crown-badge__text">月光加冕</span>
                    </span>
                  )}
                </div>
                {session && !post.is_mine && (
                  <button
                    type="button"
                    className="forum-btn-report-inline"
                    disabled={reportedKeys.has(`post:${post.id}`)}
                    onClick={() => openReportConfirm('post', post.id)}
                    title="檢舉"
                    aria-label="檢舉"
                  >
                    {reportedKeys.has(`post:${post.id}`) ? '已檢舉' : '⚑'}
                  </button>
                )}
              </div>
              {post.title && (
                <header className="forum-post-card__header">
                  <h1 className="forum-post-card__title">{post.title}</h1>
                </header>
              )}
              <div className={`forum-post-card__body-wrap${post.title ? '' : ' forum-post-card__body-wrap--no-title'}`}>
                <ForumMarkdownBody
                  content={post.content}
                  className="forum-post-card__body"
                  pollsById={pollsById}
                  loggedIn={!!session}
                  accessToken={session?.access_token}
                  onPollVote={handlePollVote}
                />
              </div>
              <div className="forum-post-card__meta">
                <div className="forum-post-card__meta-item">
                  <span className="forum-post-card__meta-label">發貼者</span>
                  <span className="forum-post-card__author-row">
                    <AuthorLinks author={post.author} isMine={post.is_mine} />
                  </span>
                </div>
                <div className="forum-post-card__meta-item forum-post-card__meta-item--date">
                  <span className="forum-post-card__meta-label">發貼時間</span>
                  <time className="forum-post-card__date" dateTime={post.created_at}>
                    {formatDate(post.created_at)}
                  </time>
                </div>
              </div>
              <div className="forum-post-card__actions">
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={post.viewer_liked || likingPost}
                  className={`forum-stat-btn forum-stat-btn--like${post.viewer_liked ? ' forum-stat-btn--liked' : ''}`}
                >
                  <span aria-hidden="true">💗</span>
                  <span>{post.like_count}</span>
                </button>
                <button type="button" onClick={scrollToComments} className="forum-stat-btn forum-stat-btn--comment">
                  <span aria-hidden="true">💬</span>
                  <span>{commentCount}</span>
                </button>
                <button
                  type="button"
                  onClick={handleBookmark}
                  disabled={bookmarking}
                  className={`forum-stat-btn forum-stat-btn--bookmark${post.viewer_bookmarked ? ' forum-stat-btn--bookmarked' : ''}`}
                >
                  <span aria-hidden="true">🔖</span>
                  <span>{post.viewer_bookmarked ? '已收藏' : '收藏'}</span>
                </button>
              </div>
              {reportNotice && (
                <p className="forum-report-notice" role="status">{reportNotice}</p>
              )}
              </>
              )}
            </article>
            </div>

            {!isStoryReading && (
            <section id="forum-comments" ref={commentsRef} className="forum-comments-section">
              <div className="forum-comments-section__head">
                <h2 className="forum-comments-section__title">
                  留言 ({opOnly ? visibleComments.length : commentCount})
                  {opOnly && visibleComments.length !== commentCount && (
                    <span className="forum-comments-section__filter-total">／{commentCount}</span>
                  )}
                </h2>
                {comments.length > 0 && hasNonOpComments && (
                  <button
                    type="button"
                    className={`forum-op-filter-btn${opOnly ? ' forum-op-filter-btn--active' : ''}`}
                    aria-pressed={opOnly}
                    onClick={() => setOpOnly((on) => !on)}
                  >
                    只看樓主
                  </button>
                )}
              </div>
              {commentsBootstrapping || storyDetailLoading ? (
                <div className="forum-comments-empty forum-comments-empty--loading">
                  <MoonLoading variant="inline" centered size={48} />
                </div>
              ) : comments.length === 0 ? (
                <div className="forum-comments-empty">
                  這裡還冷清清的… 扔個留言進來一起取暖吧！💬
                </div>
              ) : visibleComments.length === 0 ? (
                <div className="forum-comments-empty">
                  樓主暫時沒有其他留言。
                </div>
              ) : (
                <ul className="pixel-list forum-comment-list">
                  {visibleComments.map((c) => (
                    <li
                      key={c.id}
                      className={`pixel-comment-item forum-comment-item${c._pending ? ' forum-comment-item--pending' : ''}`}
                      aria-busy={c._pending ? true : undefined}
                    >
                      <div className="forum-comment-item__header">
                        <AuthorLinks author={c.author} isMine={c.is_mine} />
                        <span className="forum-comment-item__date">
                          {c._pending ? '發送中…' : formatDate(c.created_at)}
                        </span>
                        {session && !c.is_mine && !c._pending && (
                          <button
                            type="button"
                            className="forum-btn-report-reply"
                            disabled={reportedKeys.has(`comment:${c.id}`)}
                            onClick={() => openReportConfirm('comment', c.id)}
                            title="檢舉留言"
                            aria-label="檢舉留言"
                          >
                            {reportedKeys.has(`comment:${c.id}`) ? '✓' : '⚑'}
                          </button>
                        )}
                      </div>
                      <div className="forum-comment-item__body-row">
                        <ForumMarkdownBody content={c.content} className="forum-comment-item__content" />
                        {c._pending ? (
                          <span className="forum-comment-item__sending" aria-hidden="true">
                            <MoonLoading label="" size={18} centered={false} />
                          </span>
                        ) : session && !c.is_mine ? (
                          <button
                            type="button"
                            className={`forum-btn-like-comment${
                              c.viewer_liked ? ' forum-btn-like-comment--liked' : ''
                            }${likingCommentId === c.id ? ' forum-btn-like-comment--pending' : ''}`}
                            disabled={c.viewer_liked || likingCommentId === c.id}
                            onClick={() => handleCommentLike(c.id)}
                            aria-label="讚好留言"
                            aria-pressed={!!c.viewer_liked}
                          >
                            ♥ <span>{c.like_count || 0}</span>
                          </button>
                        ) : (c.like_count > 0 && (
                          <span className="forum-comment-like-count" aria-label={`${c.like_count} 個讚`}>
                            ♥ {c.like_count}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            )}

            {!isStoryReading && !storyDetailLoading && (authLoading && !session && !readStoredAuthSession()?.access_token ? (
              <div className="forum-comments-empty forum-comments-empty--loading">
                <MoonLoading centered={false} size={24} />
              </div>
            ) : session ? (
              <form
                onSubmit={handleComment}
                className={`forum-comment-form${submitting ? ' forum-comment-form--sending' : ''}`}
                aria-busy={submitting}
              >
                <ForumCommentField
                  postId={postId}
                  value={comment}
                  onChange={setComment}
                  label="回覆"
                  maxLength={500}
                  minRows={3}
                  placeholder="留下你的想法…（最多 500 字）"
                  disabled={submitting}
                />
                <div className="forum-comment-form__footer forum-comment-form__footer--actions">
                  <button
                    type="submit"
                    disabled={submitting || !comment.trim()}
                    className={`forum-comment-form__submit${submitting ? ' forum-comment-form__submit--pending' : ''}`}
                    aria-busy={submitting}
                  >
                    {submitting ? (
                      <>
                        <MoonLoading label="" size={16} centered={false} />
                        <span>發送中…</span>
                      </>
                    ) : (
                      '留言'
                    )}
                  </button>
                </div>
                {commentError && <p className="pixel-error">{commentError}</p>}
              </form>
            ) : (
              <div className="forum-comments-empty forum-comments-empty--login">
                <Link href={`/login?redirect=${encodeURIComponent(redirectPath)}`} className="pixel-link">
                  登入後才可以留言 →
                </Link>
              </div>
            ))}
          </>
          </ForumSectionErrorBoundary>
        )}
      </AppShell>
      {showBookmarks && (
        <ForumBookmarksPanel
          open={showBookmarks}
          onClose={() => setShowBookmarks(false)}
          accessToken={session?.access_token}
          onBookmarkChange={handleBookmarkChange}
        />
      )}
      <ForumReportConfirmOverlay
        open={!!reportPending}
        title={reportPending?.title || '確認檢舉？'}
        sub={reportPending?.sub || ''}
        onConfirm={confirmReport}
        onCancel={closeReportConfirm}
        confirming={reportConfirming}
      />
    </>
  );
}

/**
 * SSR meta for crawlers: real <title>/<meta> in the initial HTML instead of a
 * generic「貼文」shell, plus real 404s for missing posts (avoids soft-404s).
 * Client-side data loading is unchanged — this only feeds the <head>.
 */
export async function getServerSideProps({ params, res }) {
  const postId = normalizeRouteId(params?.postId);
  if (!postId || !/^[0-9a-f-]{20,40}$/i.test(postId)) {
    return { notFound: true };
  }

  try {
    const { getAdminClient } = await import('../../lib/server-auth.js');
    const admin = getAdminClient();
    const { data: post } = await admin
      .from('forum_posts')
      .select('id, title, content, topic, visibility, anonymous_name_snapshot, hide_username, like_count, comment_count, created_at')
      .eq('id', postId)
      .maybeSingle();

    if (!post || post.visibility === 'hidden') {
      return { notFound: true };
    }

    const indexable = post.visibility !== 'members_only'
      && !isMatureForumTopicStored(post.topic);

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');

    return {
      props: {
        seo: {
          id: post.id,
          title: post.title || '貼文',
          // Members-only/mature posts stay noindex and expose no content.
          excerpt: indexable ? seoExcerpt(post.content) : '',
          author_name: indexable && !post.hide_username ? (post.anonymous_name_snapshot || null) : null,
          like_count: post.like_count || 0,
          comment_count: post.comment_count || 0,
          created_at: post.created_at || null,
          indexable,
        },
      },
    };
  } catch (err) {
    console.error('[forum/postId] SSR meta failed:', err?.message || err);
    // Never block the page on SEO metadata — fall back to client rendering.
    return { props: { seo: null } };
  }
}
