/**
 * /forum — Forum post list + compose
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context.js';
import AppShell from '../../components/AppShell.js';
import ForumHeaderAuth from '../../components/ForumHeaderAuth.js';
import ForumHeaderLogo from '../../components/ForumHeaderLogo.js';
import ForumBookmarksPanel from '../../components/ForumBookmarksPanel.js';
import ForumAuthorName from '../../components/ForumAuthorName.js';
import HeaderPremiumMoon from '../../components/HeaderPremiumMoon.js';
import { isPremiumUser } from '../../lib/premium.js';
import ForumCampfireGlow from '../../components/ForumCampfireGlow.js';
import SeoHead from '../../components/SeoHead.js';
import { organizationJsonLd, webSiteJsonLd } from '../../lib/structured-data.js';
import {
  FORUM_TOPICS,
  TOPIC_STYLES,
  FORUM_DISPLAY_NAME,
  getWelcomePost,
  getEmptyStateCopy,
  displayTopic,
} from '../../lib/forum-welcome.js';
import {
  getOfficialTagKeysForTopic,
  mergePresetTagsWithCounts,
} from '../../lib/forum-categories.js';
import MirrorFamilyBadge from '../../components/MirrorFamilyBadge.js';
import ForumComposeField from '../../components/ForumComposeField.js';
import ForumComposeOverlay from '../../components/ForumComposeOverlay.js';
import ForumTagField from '../../components/ForumTagField.js';
import ForumPostTags from '../../components/ForumPostTags.js';
import { formatForumTagLabel, canonicalForumTagKey } from '../../lib/forum-tags.js';
import {
  clearForumDraft,
  FORUM_POST_DRAFT_KEY,
  readForumDraft,
  writeForumDraft,
} from '../../lib/forum-draft-storage.js';
import {
  readForumFeedCache,
  writeForumFeedCache,
  isForumFeedCacheStale,
  clearForumFeedCache,
  FORUM_FEED_STALE_MS,
} from '../../lib/forum-feed-cache.js';
import PageLoadingShell from '../../components/PageLoadingShell.js';
import MoonLoading from '../../components/MoonLoading.js';
import MoonJourneyPanel from '../../components/MoonJourneyPanel.js';
import ForumMoonJourneyMobile from '../../components/ForumMoonJourneyMobile.js';
import {
  readMoonJourneyCacheEntry,
  writeMoonJourneyCache,
  resolveMoonJourneyUpdate,
  shouldSkipMoonJourneyRefresh,
} from '../../lib/moon-journey-cache.js';
import ForumMatureGate from '../../components/ForumMatureGate.js';
import {
  isMatureForumTopic,
  MATURE_FORUM_TOPIC,
  MATURE_POST_RULES_SUMMARY,
  readMatureGateAck,
} from '../../lib/forum-mature.js';

const SORT_OPTIONS = [
  { id: 'latest', label: '最新', icon: '🕐', hint: '依發文時間由新到舊' },
  { id: 'popular', label: '熱門', icon: '🔥', hint: '依愛心數由高到低' },
  { id: 'clan', label: '同族', icon: '🐾', hint: '同家族的貼文', authOnly: true },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return '剛才';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 日前`;
}

function topicBadgeStyle(topic) {
  const ts = TOPIC_STYLES[topic] || TOPIC_STYLES['全部'];
  return {
    '--topic-accent': ts.accent,
    '--topic-accent2': ts.accent,
    '--topic-glow': ts.glow,
    '--topic-border': `${ts.accent}55`,
    '--topic-color': ts.accent,
    '--topic-bg': `${ts.glow}`,
  };
}

/** Scroll active topic badge within the row only (avoid page-level scrollIntoView). */
function scrollTopicBadgeIntoView(row, badge, behavior = 'smooth') {
  if (!row || !badge) return;
  const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
  if (maxScroll <= 0) return;
  const target = badge.offsetLeft - (row.clientWidth - badge.offsetWidth) / 2;
  row.scrollTo({
    left: Math.max(0, Math.min(target, maxScroll)),
    behavior,
  });
}

/** Desktop: wheel + drag horizontal scroll (scrollbar hidden via CSS). */
function useHorizontalRowScroll(rowRef, dragRef, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const row = rowRef.current;
    if (!row) return undefined;

    const DRAG_THRESHOLD_PX = 4;
    let tracking = false;
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startScroll = 0;
    let suppressClick = false;

    function canScroll() {
      return row.scrollWidth > row.clientWidth + 1;
    }

    function unbindDocument() {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onDocumentPointerUp);
      document.removeEventListener('pointercancel', onDocumentPointerUp);
    }

    function onWheel(e) {
      if (!canScroll()) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      row.scrollLeft += delta;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (!canScroll()) return;
      tracking = true;
      dragging = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = row.scrollLeft;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onDocumentPointerUp);
      document.addEventListener('pointercancel', onDocumentPointerUp);
    }

    function onPointerMove(e) {
      if (!tracking || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > DRAG_THRESHOLD_PX) {
        dragging = true;
        row.classList.add('forum-h-scroll--dragging');
        try {
          row.setPointerCapture(e.pointerId);
        } catch {
          /* unsupported */
        }
      }
      if (dragging) {
        e.preventDefault();
        const maxScroll = row.scrollWidth - row.clientWidth;
        row.scrollLeft = Math.max(0, Math.min(startScroll - dx, maxScroll));
      }
    }

    function endDrag(e) {
      if (!tracking) return;
      if (e?.pointerId !== undefined && pointerId !== null && e.pointerId !== pointerId) return;
      unbindDocument();
      if (dragging) {
        suppressClick = true;
        if (dragRef) dragRef.current = true;
        row.classList.remove('forum-h-scroll--dragging');
        try {
          if (e?.pointerId !== undefined) row.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      tracking = false;
      dragging = false;
      pointerId = null;
    }

    function onDocumentPointerUp(e) {
      endDrag(e);
    }

    function onClickCapture(e) {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
      if (dragRef) dragRef.current = false;
    }

    row.addEventListener('wheel', onWheel, { passive: false });
    row.addEventListener('pointerdown', onPointerDown);
    row.addEventListener('click', onClickCapture, true);

    return () => {
      unbindDocument();
      row.removeEventListener('wheel', onWheel);
      row.removeEventListener('pointerdown', onPointerDown);
      row.removeEventListener('click', onClickCapture, true);
      row.classList.remove('forum-h-scroll--dragging');
    };
  }, [rowRef, dragRef, active]);
}

/** Back-compat alias (older builds referenced this name). */
const useTopicsRowScroll = useHorizontalRowScroll;

function WelcomeCard({ topic }) {
  const welcome = getWelcomePost(topic);
  const ts = TOPIC_STYLES[topic] || TOPIC_STYLES['全部'];
  return (
    <article
      className="forum-welcome-card"
      style={{ borderColor: `${ts.accent}55` }}
    >
      <h3 className="forum-welcome-card__title">
        {ts.emoji} {welcome.title}
      </h3>
      <p className="forum-welcome-card__content">{welcome.content}</p>
    </article>
  );
}

function EmptyState({ topic, onCompose, canCompose, sort, viewerClanType }) {
  const copy = getEmptyStateCopy(topic);
  const isClanNoMirror = sort === 'clan' && canCompose && !viewerClanType;
  const isClanEmpty = sort === 'clan' && viewerClanType;

  return (
    <div className="forum-empty">
      <ForumCampfireGlow variant="hero" />
      {isClanNoMirror ? (
        <>
          <h2 className="forum-empty__headline">還未加入任何貓家族</h2>
          <p className="forum-empty__subline">完成 Mirror 測驗後，就能在同族模式找到氣場相近的貓咪 🐾</p>
          <Link href="/mirror.html" className="forum-empty__cta">
            開始 Mirror 測驗
          </Link>
        </>
      ) : isClanEmpty ? (
        <>
          <h2 className="forum-empty__headline">同族暫時未有貼文</h2>
          <p className="forum-empty__subline">
            <MirrorFamilyBadge type={viewerClanType} variant="compact" className="forum-empty__clan-badge" />
            {' '}的貓咪還沒開口，來點第一把火吧 🔥
          </p>
          <button type="button" className="forum-empty__cta" onClick={onCompose}>
            立刻發文
          </button>
        </>
      ) : (
        <>
          <h2 className="forum-empty__headline">{copy.headline}</h2>
          <p className="forum-empty__subline">{copy.subline} {copy.emoji}</p>
          {canCompose ? (
            <button type="button" className="forum-empty__cta" onClick={onCompose}>
              立刻發文
            </button>
          ) : (
            <Link href="/login?redirect=/forum" className="forum-empty__cta">
              登入後發文
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function GatheringPanel({ count }) {
  return (
    <aside className="forum-panel forum-panel--stat">
      <div className="forum-panel__head">
        <h3 className="forum-panel__title">圍爐人數</h3>
        <p className="forum-panel__hint forum-panel__hint--hot">近 24 小時活躍</p>
      </div>
      <div className="forum-gathering-count forum-gathering-count--body">
        {count ?? '—'}
        <span>目前有 {count ?? '…'} 隻黑貓正在圍爐取暖</span>
      </div>
    </aside>
  );
}

function FeaturedPostsPanel({ featuredPosts }) {
  if (!featuredPosts?.length) return null;

  return (
    <aside className="forum-panel forum-panel--featured">
      <div className="forum-panel__head">
        <h3 className="forum-panel__title">✨ 月光精選</h3>
        <p className="forum-panel__hint forum-panel__hint--hot">版主加冕的優質文章</p>
      </div>
      <ol className="forum-hot-list">
        {featuredPosts.map((p) => (
          <li key={p.id}>
            <Link href={`/forum/${p.id}`} className="forum-hot-item">
              <span className="forum-hot-item__rank" aria-hidden="true">✨</span>
              <div className="forum-hot-item__body">
                <p className="forum-hot-item__title">{p.title || p.topic}</p>
                <span className="forum-hot-item__meta">
                  <span className="forum-hot-item__topic">{displayTopic(p.topic)}</span>
                  <span className="forum-hot-item__stats">
                    <span>💗 {p.like_count}</span>
                    <span>💬 {p.comment_count}</span>
                  </span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function HotTopicsPanel({ hotPosts }) {
  const trophies = ['🥇', '🥈', '🥉'];
  const rankMods = ['forum-hot-item--gold', 'forum-hot-item--silver', 'forum-hot-item--bronze'];

  return (
    <aside className="forum-panel forum-panel--hot">
      <div className="forum-panel__head">
        <h3 className="forum-panel__title">🔥 活躍火種</h3>
        <p className="forum-panel__hint forum-panel__hint--hot">本週最活躍 TOP 3</p>
      </div>
      {(!hotPosts || hotPosts.length === 0) ? (
        <p className="forum-hot-empty">本週還沒有火種，來點第一把火吧。</p>
      ) : (
        <ol className="forum-hot-list">
          {hotPosts.map((p, index) => (
            <li key={p.id}>
              <Link
                href={`/forum/${p.id}`}
                className={`forum-hot-item${rankMods[index] ? ` ${rankMods[index]}` : ''}`}
              >
                <span className="forum-hot-item__rank" aria-label={`第 ${index + 1} 名`}>
                  {trophies[index]}
                </span>
                <div className="forum-hot-item__body">
                  <p className="forum-hot-item__title">{p.title || p.topic}</p>
                  <span className="forum-hot-item__meta">
                    <span className="forum-hot-item__topic">{p.topic}</span>
                    <span className="forum-hot-item__stats">
                      <span>💗 {p.like_count}</span>
                      <span>💬 {p.comment_count}</span>
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function applyForumCache(entry, {
  setPosts,
  setMeta,
  setFeaturedPosts,
  setMetaTopic,
  setTagLabels,
  setViewerClanType,
  setHasMore,
  offsetRef,
  setOffset,
}) {
  if (!entry) return;
  setPosts(entry.posts || []);
  setMeta(entry.meta ?? null);
  setFeaturedPosts(entry.featuredPosts || []);
  setMetaTopic(entry.metaTopic ?? null);
  if (entry.tagLabels) setTagLabels(entry.tagLabels);
  if (entry.viewerClanType !== undefined) setViewerClanType(entry.viewerClanType);
  setHasMore(entry.hasMore ?? false);
  const nextOffset = entry.offset ?? 20;
  offsetRef.current = nextOffset;
  setOffset(nextOffset);
}

export default function ForumPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState(null);
  const [topic, setTopic] = useState('全部');
  const [activeTag, setActiveTag] = useState(null);
  const [sort, setSort] = useState('latest');
  const [showCompose, setShowCompose] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarkingIds, setBookmarkingIds] = useState(() => new Set());
  const [bookmarkToast, setBookmarkToast] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [viewerClanType, setViewerClanType] = useState(null);
  const [meta, setMeta] = useState(null);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [metaTopic, setMetaTopic] = useState(null);
  const [moonJourney, setMoonJourneyState] = useState(null);
  const [tagLabels, setTagLabels] = useState({});
  const [loadError, setLoadError] = useState(false);
  const [pageBootstrapping, setPageBootstrapping] = useState(true);
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [matureAcked, setMatureAcked] = useState(false);
  const topicRef = useRef(topic);
  const initialLoadDoneRef = useRef(false);
  const filterSnapshotRef = useRef({ topic, sort, activeTag });

  const defaultTopic = topic === '全部' ? '社群' : topic;
  const [form, setForm] = useState({
    title: '',
    content: '',
    topic: defaultTopic,
    tags: [],
    visibility: 'public',
    polls: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const offsetRef = useRef(0);
  const topicsRowRef = useRef(null);
  const topicsRowDragRef = useRef(false);
  const presetTagsScrollRef = useRef(null);
  const presetTagsDragRef = useRef(false);
  const hotTagsScrollRef = useRef(null);
  const hotTagsDragRef = useRef(false);
  const loadSeqRef = useRef(0);
  const sessionRef = useRef(session);
  const loadedWithTokenRef = useRef(undefined);
  const moonJourneyCacheRef = useRef(null);

  const setMoonJourney = useCallback((next) => {
    setMoonJourneyState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const userId = sessionRef.current?.user?.id;
      if (userId && resolved) {
        writeMoonJourneyCache(userId, resolved);
        moonJourneyCacheRef.current = readMoonJourneyCacheEntry(userId);
      }
      return resolved;
    });
  }, []);

  useEffect(() => {
    sessionRef.current = session;
    const userId = session?.user?.id;
    const token = session?.access_token;
    if (!userId) {
      moonJourneyCacheRef.current = null;
      setMoonJourneyState(null);
      return undefined;
    }
    const entry = readMoonJourneyCacheEntry(userId);
    moonJourneyCacheRef.current = entry;
    if (entry?.journey) {
      setMoonJourneyState((prev) => prev ?? entry.journey);
    }

    if (!token || shouldSkipMoonJourneyRefresh(entry)) return undefined;

    let cancelled = false;
    fetch('/api/forum/moon-journey', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const next = resolveMoonJourneyUpdate(
          moonJourneyCacheRef.current,
          data?.moon_journey ?? null,
        );
        if (next) setMoonJourney(next);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session, setMoonJourney]);

  useEffect(() => {
    const row = topicsRowRef.current;
    if (!row) return undefined;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      if (topic === '全部') {
        row.scrollLeft = 0;
        return;
      }
      const active = row.querySelector('.forum-topic-badge--active');
      scrollTopicBadgeIntoView(row, active, 'smooth');
    };
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [topic]);

  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);

  const matureTopicActive = isMatureForumTopic(topic);
  const showMatureGate = matureTopicActive && (!session || !matureAcked);

  useEffect(() => {
    if (!matureTopicActive) return;
    setMatureAcked(readMatureGateAck(session?.user?.id));
  }, [matureTopicActive, topic, session?.user?.id]);

  const applyMetaPayload = useCallback((requestedTopic, data) => {
    if (requestedTopic !== topicRef.current) return;
    const payload = data || {};
    setMeta(payload);
    setMetaTopic(requestedTopic);
    if ('moon_journey' in payload) {
      const entry = moonJourneyCacheRef.current;
      const next = resolveMoonJourneyUpdate(entry, payload.moon_journey ?? null);
      if (next) {
        setMoonJourney(next);
      } else if (payload.moon_journey === null) {
        setMoonJourney(null);
      }
    }
    if (payload.preset_tags?.length || payload.user_hot_tags?.length || payload.hot_tags?.length) {
      setTagLabels((prev) => {
        const next = { ...prev };
        for (const item of [...(payload.preset_tags || []), ...(payload.user_hot_tags || []), ...(payload.hot_tags || [])]) {
          if (item.tag && item.display_label) next[item.tag] = item.display_label;
        }
        return next;
      });
    }
  }, [setMoonJourney]);

  const fetchMeta = useCallback(async (requestedTopic, headers, { skipMoonJourney = false } = {}) => {
    const topicParam = requestedTopic === '全部' ? '' : `?topic=${encodeURIComponent(requestedTopic)}`;
    const skipParam = skipMoonJourney ? `${topicParam ? '&' : '?'}skip_moon_journey=1` : '';
    try {
      const r = await fetch(`/api/forum/meta${topicParam}${skipParam}`, { headers });
      if (!r.ok) return {};
      return await r.json();
    } catch {
      return {};
    }
  }, []);

  const loadMeta = useCallback(async ({ skipMoonJourney = false } = {}) => {
    const requestedTopic = topicRef.current;
    const headers = {};
    const token = sessionRef.current?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    const data = await fetchMeta(requestedTopic, headers, { skipMoonJourney });
    applyMetaPayload(requestedTopic, data);
  }, [fetchMeta, applyMetaPayload]);

  const metaMatchesTopic = metaTopic === topic;

  const presetTagsDisplay = useMemo(() => {
    if (topic === '全部') return [];
    const counts = metaMatchesTopic
      ? [...(meta?.preset_tags || []), ...(meta?.user_hot_tags || []), ...(meta?.hot_tags || [])]
      : [];
    return mergePresetTagsWithCounts(topic, counts);
  }, [topic, meta, metaMatchesTopic]);

  const userHotTagsDisplay = useMemo(() => {
    if (!metaMatchesTopic) return [];
    if (topic === '全部') return meta?.hot_tags || [];
    return meta?.user_hot_tags || [];
  }, [topic, meta, metaMatchesTopic]);

  const showPresetTagsRow = topic !== '全部' && (presetTagsDisplay.length > 0 || activeTag);
  const showHotTagsRow = userHotTagsDisplay.length > 0;

  useHorizontalRowScroll(topicsRowRef, topicsRowDragRef, true);
  useHorizontalRowScroll(presetTagsScrollRef, presetTagsDragRef, showPresetTagsRow);
  useHorizontalRowScroll(hotTagsScrollRef, hotTagsDragRef, showHotTagsRow);

  const load = useCallback(async (reset = false, { bootstrap = false, silent = false, feedOnly = false, postsOnly = false } = {}) => {
    const seq = ++loadSeqRef.current;
    const newOffset = reset ? 0 : offsetRef.current;
    const requestedTopic = topic;
    const topicParam = topic === '全部' ? '' : `&topic=${encodeURIComponent(topic)}`;
    const tagParam = activeTag ? `&tag=${encodeURIComponent(activeTag)}` : '';
    const headers = {};
    const token = sessionRef.current?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;

    if (bootstrap) {
      if (!silent) {
        if (feedOnly || initialLoadDoneRef.current) {
          setFeedRefreshing(true);
        } else {
          setPageBootstrapping(true);
        }
      }
      if (reset && !silent) setPosts(null);
    }

    const applyPostsPayload = (r, data) => {
      if (!r.ok) {
        if (data?.code === 'mature_login_required') {
          setPosts([]);
          setHasMore(false);
          setLoadError(false);
          return;
        }
        if (reset) setPosts([]);
        setHasMore(false);
        setLoadError(true);
        return;
      }
      setLoadError(false);
      const incoming = data.posts || [];
      setPosts(reset ? incoming : (prev) => [...(prev || []), ...incoming]);
      setHasMore(data.has_more || false);
      if (data.tag_labels) {
        setTagLabels((prev) => (reset ? data.tag_labels : { ...prev, ...data.tag_labels }));
      }
      if (sort === 'clan') {
        setViewerClanType(data.viewer_clan_type ?? null);
      }
      const nextOffset = newOffset + 20;
      offsetRef.current = nextOffset;
      setOffset(nextOffset);
    };

    try {
      if (reset) {
        const postsResPromise = fetch(
          `/api/forum/posts?sort=${sort}&limit=20&offset=0${topicParam}${tagParam}`,
          { headers },
        );
        if (!postsOnly) {
          const skipMoonJourney = shouldSkipMoonJourneyRefresh(moonJourneyCacheRef.current);
          fetchMeta(requestedTopic, headers, { skipMoonJourney }).then((metaData) => {
            if (seq !== loadSeqRef.current) return;
            applyMetaPayload(requestedTopic, metaData);
          });
          if (requestedTopic === '全部') {
            fetch('/api/forum/featured')
              .then((r) => r.json().catch(() => ({})))
              .then((data) => {
                if (seq !== loadSeqRef.current) return;
                setFeaturedPosts(data.featured_posts || []);
              });
          }
        }
        const postsRes = await postsResPromise;
        if (seq !== loadSeqRef.current) return;
        const data = await postsRes.json().catch(() => ({}));
        applyPostsPayload(postsRes, data);
      } else {
        const r = await fetch(`/api/forum/posts?sort=${sort}&limit=20&offset=${newOffset}${topicParam}${tagParam}`, { headers });
        const data = await r.json().catch(() => ({}));
        if (seq !== loadSeqRef.current) return;
        applyPostsPayload(r, data);
      }
    } catch {
      if (seq !== loadSeqRef.current) return;
      if (reset) {
        applyMetaPayload(requestedTopic, {});
        setPosts([]);
        setHasMore(false);
        setLoadError(true);
      }
    } finally {
      if (bootstrap && seq === loadSeqRef.current) {
        setPageBootstrapping(false);
        setFeedRefreshing(false);
        initialLoadDoneRef.current = true;
        loadedWithTokenRef.current = sessionRef.current?.access_token ?? null;
      }
    }
  }, [topic, sort, activeTag, fetchMeta, applyMetaPayload]);

  const handleMatureAcknowledged = useCallback(() => {
    setMatureAcked(true);
    clearForumFeedCache();
    load(true, { bootstrap: true, feedOnly: initialLoadDoneRef.current });
  }, [load]);

  const handleMatureDismiss = useCallback(() => {
    setActiveTag(null);
    setTopic('全部');
  }, []);

  const selectTopic = useCallback((nextTopic) => {
    if (nextTopic === topicRef.current) return;
    setActiveTag(null);
    setTopic(nextTopic);
  }, []);

  useEffect(() => {
    const prev = filterSnapshotRef.current;
    const topicChanged = prev.topic !== topic;
    const sortChanged = prev.sort !== sort;
    const tagChanged = prev.activeTag !== activeTag;
    filterSnapshotRef.current = { topic, sort, activeTag };

    const postsOnly = initialLoadDoneRef.current && !topicChanged && (tagChanged || sortChanged);

    offsetRef.current = 0;
    setOffset(0);
    setLoadError(false);

    if (isMatureForumTopic(topic)) {
      const acked = readMatureGateAck(sessionRef.current?.user?.id);
      setMatureAcked(acked);
      if (!sessionRef.current || !acked) {
        setPosts([]);
        setPageBootstrapping(false);
        setFeedRefreshing(false);
        setHasMore(false);
        return;
      }
    }

    const cached = readForumFeedCache(sort, topic, activeTag);
    if (cached) {
      applyForumCache(cached, {
        setPosts,
        setMeta,
        setFeaturedPosts,
        setMetaTopic,
        setTagLabels,
        setViewerClanType,
        setHasMore,
        offsetRef,
        setOffset,
      });
      setPageBootstrapping(false);
      setFeedRefreshing(false);
      load(true, { bootstrap: false, silent: true, postsOnly });
    } else {
      load(true, {
        bootstrap: true,
        feedOnly: initialLoadDoneRef.current,
        postsOnly,
      });
    }
  }, [topic, sort, activeTag, load, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    if (pageBootstrapping) return;
    const token = session?.access_token ?? null;
    if (loadedWithTokenRef.current === token) return;
    loadedWithTokenRef.current = token;
    if (posts === null) return;
    load(true, { bootstrap: false });
  }, [authLoading, session?.access_token, pageBootstrapping, posts, load]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (posts === null || pageBootstrapping) return;
      const cached = readForumFeedCache(sort, topic, activeTag);
      if (cached && !isForumFeedCacheStale(cached)) return;
      load(true, { bootstrap: false, silent: true });
      const skipMoonJourney = shouldSkipMoonJourneyRefresh(moonJourneyCacheRef.current);
      loadMeta({ skipMoonJourney });
    }, FORUM_FEED_STALE_MS);
    return () => clearInterval(interval);
  }, [posts, pageBootstrapping, sort, topic, activeTag, load, loadMeta]);

  useEffect(() => {
    if (!posts || pageBootstrapping) return;
    writeForumFeedCache(sort, topic, activeTag, {
      posts,
      meta,
      featuredPosts,
      metaTopic,
      tagLabels,
      viewerClanType,
      hasMore,
      offset: offsetRef.current,
    });
  }, [posts, meta, featuredPosts, metaTopic, tagLabels, viewerClanType, hasMore, pageBootstrapping, sort, topic, activeTag]);

  useEffect(() => {
    function onFocus() {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const skipMoonJourney = shouldSkipMoonJourneyRefresh(moonJourneyCacheRef.current);
      loadMeta({ skipMoonJourney });
      if (posts === null || pageBootstrapping) return;
      const cached = readForumFeedCache(sort, topic, activeTag);
      if (cached && !isForumFeedCacheStale(cached)) return;
      load(true, { bootstrap: false, silent: true });
    }
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
    };
  }, [loadMeta, posts, pageBootstrapping, sort, topic, activeTag, load]);

  useEffect(() => {
    setForm((f) => ({ ...f, topic: topic === '全部' ? '社群' : topic }));
  }, [topic]);

  useEffect(() => {
    if (isMatureForumTopic(form.topic)) {
      setForm((f) => (f.visibility === 'members_only' ? f : { ...f, visibility: 'members_only' }));
    }
  }, [form.topic]);

  useEffect(() => {
    if (!bookmarkToast) return undefined;
    const timer = setTimeout(() => setBookmarkToast(''), 2800);
    return () => clearTimeout(timer);
  }, [bookmarkToast]);

  function openCompose() {
    const draft = readForumDraft(FORUM_POST_DRAFT_KEY);
    const nextTopic = draft?.topic || (topic === '全部' ? '社群' : topic);
    setForm({
      title: draft?.title || '',
      content: draft?.content || '',
      topic: nextTopic,
      tags: Array.isArray(draft?.tags)
        ? [...new Set(draft.tags.map((t) => canonicalForumTagKey(t)).filter(Boolean))]
        : (draft?.mood_tag ? [canonicalForumTagKey(draft.mood_tag)] : []),
      visibility: isMatureForumTopic(nextTopic) || draft?.visibility === 'members_only'
        ? 'members_only'
        : 'public',
      polls: Array.isArray(draft?.polls) ? draft.polls : [],
    });
    setDraftNotice(draft?.savedAt ? '已恢復草稿' : '');
    setShowCompose(true);
  }

  useEffect(() => {
    if (!showCompose) return undefined;
    const timer = setInterval(() => {
      if (!form.content.trim() && !form.title.trim()) return;
      writeForumDraft(FORUM_POST_DRAFT_KEY, form);
      setDraftNotice('草稿已自動儲存');
    }, 3000);
    return () => clearInterval(timer);
  }, [showCompose, form]);

  function closeCompose() {
    clearForumDraft(FORUM_POST_DRAFT_KEY);
    setForm({
      title: '',
      content: '',
      topic: topic === '全部' ? '社群' : topic,
      tags: [],
      visibility: 'public',
      polls: [],
    });
    setSubmitError('');
    setDraftNotice('');
    setShowCompose(false);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.content.trim()) { setSubmitError('請填寫內容。'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const r = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.error || '發文失敗。');
        return;
      }
      setForm({
        title: '',
        content: '',
        topic: topic === '全部' ? '社群' : topic,
        tags: [],
        visibility: 'public',
        polls: [],
      });
      clearForumDraft(FORUM_POST_DRAFT_KEY);
      setDraftNotice('');
      setShowCompose(false);
      clearForumFeedCache();
      load(true, { bootstrap: false, silent: true });
      loadMeta();
    } catch {
      setSubmitError('發文失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleBookmark(postId, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      router.push(`/login?redirect=${encodeURIComponent('/forum')}`);
      return;
    }
    if (bookmarkingIds.has(postId)) return;

    setBookmarkingIds((prev) => new Set(prev).add(postId));
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
      setPosts((prev) => (prev || []).map((p) => (
        p.id === postId ? { ...p, viewer_bookmarked: !!result.bookmarked } : p
      )));
      setBookmarkToast(result.bookmarked ? 'saved' : 'removed');
    } catch {
      alert('網路錯誤，請重試。');
    } finally {
      setBookmarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  function handleBookmarkChange(postId, bookmarked) {
    setPosts((prev) => (
      prev ? prev.map((p) => (p.id === postId ? { ...p, viewer_bookmarked: bookmarked } : p)) : prev
    ));
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refresh = () => window.MobileDocumentScroll?.refreshAppPageScrollExtent?.();
    refresh();
    const t1 = window.setTimeout(refresh, 120);
    const t2 = window.setTimeout(refresh, 480);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [posts, topic, sort, activeTag, hasMore, meta]);

  const isPremium = isPremiumUser(profile);
  const shellLoading = pageBootstrapping && posts === null;
  const feedLoading = feedRefreshing || (posts === null && !shellLoading);
  const isEmpty = !feedLoading && Array.isArray(posts) && posts.length === 0;
  const feedPosts = posts || [];
  const showEmptyState = isEmpty && !loadError;
  const showWelcomeCard = isEmpty && sort !== 'clan' && !loadError;

  if (shellLoading) {
    return (
      <>
        <SeoHead
          title={FORUM_DISPLAY_NAME}
          description="黑貓樹洞 — 在月光下匿名分享心情、認識同 Mirror 家族的朋友，參與 Black Cat Under The Moon 社群。"
          path="/forum"
          jsonLd={[organizationJsonLd(), webSiteJsonLd()]}
        />
        <PageLoadingShell
          label="正在載入樹洞…"
          pageClassName="app-page--forum"
          loadingCalm
          warmBackground
          showStarfield={false}
          maxWidth="100%"
          headerBrand={<ForumHeaderLogo />}
          headerVariant="forum"
          nav={(
            <ForumHeaderAuth
              onBookmarksClick={() => {}}
              moonJourney={null}
              extra={null}
            />
          )}
        />
      </>
    );
  }

  return (
    <>
      <SeoHead
        title={matureTopicActive ? `${MATURE_FORUM_TOPIC} · ${FORUM_DISPLAY_NAME}` : FORUM_DISPLAY_NAME}
        description={matureTopicActive
          ? '黑貓樹洞成熟話題版 — 已登入會員的文字討論空間，分享親密關係、界線與同意。'
          : '黑貓樹洞 — 在月光下匿名分享心情、認識同 Mirror 家族的朋友，參與 Black Cat Under The Moon 社群。'}
        path="/forum"
        noindex={matureTopicActive}
        jsonLd={[organizationJsonLd(), webSiteJsonLd()]}
      />
      <AppShell
        headerBrand={<ForumHeaderLogo />}
        headerVariant="forum"
        pageClassName="app-page--forum"
        warmBackground
        showStarfield={false}
        maxWidth="100%"
        hideHeader={false}
        nav={
          <ForumHeaderAuth
            onBookmarksClick={() => setShowBookmarks(true)}
            moonJourney={(
              <ForumMoonJourneyMobile
                accessToken={session?.access_token}
                userId={session?.user?.id}
                journey={moonJourney}
                onJourneyUpdate={setMoonJourney}
              />
            )}
            extra={
              session ? (
                <button type="button" className="forum-compose-btn" onClick={openCompose}>
                  + 發文
                </button>
              ) : (
                <Link href="/login?redirect=/forum" className="forum-compose-btn" style={{ textDecoration: 'none' }}>
                  + 發文
                </Link>
              )
            }
          />
        }
      >
        <div className="forum-layout">
          <div className="forum-sidebar forum-sidebar--left">
            <GatheringPanel count={meta?.gathering_count} />
            <MoonJourneyPanel
              accessToken={session?.access_token}
              journey={moonJourney}
              onJourneyUpdate={setMoonJourney}
            />
          </div>

          <div className="forum-main">
            <div className="forum-filters-panel forum-panel">
              <div
                ref={topicsRowRef}
                className="pixel-filter-row pixel-filter-row--topics forum-h-scroll"
                role="tablist"
                aria-label="論壇分類"
              >
                {FORUM_TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => selectTopic(t)}
                    className={`forum-topic-badge${topic === t ? ' forum-topic-badge--active' : ''}${t === MATURE_FORUM_TOPIC ? ' forum-topic-badge--mature' : ''}`}
                    style={topicBadgeStyle(t)}
                  >
                    {TOPIC_STYLES[t]?.emoji ? `${TOPIC_STYLES[t].emoji} ` : ''}{t}
                    {t === MATURE_FORUM_TOPIC && (
                      <span className="forum-topic-badge__age" aria-label="年滿18歲">18+</span>
                    )}
                  </button>
                ))}
              </div>

              {(topic !== '全部' && (presetTagsDisplay.length > 0 || activeTag)) && (
                <div className="forum-preset-tags-row" role="group" aria-label="官方標籤">
                  <span className="forum-preset-tags-row__label">標籤</span>
                  <div ref={presetTagsScrollRef} className="forum-preset-tags-row__scroll forum-h-scroll">
                    {(() => {
                      const displayTags = activeTag && !presetTagsDisplay.some((t) => t.tag === activeTag)
                        ? [{ tag: activeTag, display_label: tagLabels[activeTag] || activeTag, count: 0, official: false }, ...presetTagsDisplay]
                        : presetTagsDisplay;
                      return displayTags.map(({ tag, display_label: displayLabel, count, official }) => {
                        const isActive = activeTag === tag;
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`forum-tag-chip forum-tag-chip--preset${official ? ' forum-tag-chip--official' : ''}${isActive ? ' forum-tag-chip--active' : ''}`}
                            aria-pressed={isActive}
                            onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
                          >
                            <span>{formatForumTagLabel(tag, displayLabel, tagLabels)}</span>
                            {count > 0 && (
                              <span className="forum-tag-chip__count">{count}</span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {userHotTagsDisplay.length > 0 && (
                <div className="forum-hot-tags-row" role="group" aria-label="熱門標籤">
                  <span className="forum-hot-tags-row__label">{topic === '全部' ? '熱門' : '社群'}</span>
                  <div ref={hotTagsScrollRef} className="forum-hot-tags-row__scroll forum-h-scroll">
                    {userHotTagsDisplay.map(({ tag, display_label: displayLabel, count }) => {
                      const isActive = activeTag === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`forum-tag-chip forum-tag-chip--hot${isActive ? ' forum-tag-chip--active' : ''}`}
                          aria-pressed={isActive}
                          onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
                        >
                          <span>{formatForumTagLabel(tag, displayLabel, tagLabels)}</span>
                          {count > 0 && (
                            <span className="forum-tag-chip__count">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="forum-sort-row">
                <span className="forum-sort-row__label">排序</span>
                <div className="forum-sort-group" role="group" aria-label="貼文排序">
                  {SORT_OPTIONS.filter((o) => !o.authOnly || session).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSort(o.id)}
                      aria-pressed={sort === o.id}
                      className={`forum-sort-badge${sort === o.id ? ' forum-sort-badge--active' : ''}`}
                    >
                      <span className="forum-sort-badge__icon" aria-hidden="true">{o.icon}</span>
                      {o.label}
                    </button>
                  ))}
                </div>
                <span className="forum-sort-row__hint">
                  <span className="forum-sort-row__hint-text">
                    {SORT_OPTIONS.find((o) => o.id === sort)?.hint}
                  </span>
                  {sort === 'clan' && viewerClanType && (
                    <MirrorFamilyBadge type={viewerClanType} variant="hero" showImage />
                  )}
                  {sort === 'clan' && !viewerClanType && session && (
                    <Link href="/mirror.html" className="forum-sort-row__clan-cta">
                      完成 Mirror 測驗 →
                    </Link>
                  )}
                </span>
              </div>
            </div>

            {topic === '全部' && (
              <div className="forum-treehole-panels forum-treehole-panels--mobile">
                <GatheringPanel count={meta?.gathering_count} />
                <FeaturedPostsPanel featuredPosts={featuredPosts} />
                <HotTopicsPanel hotPosts={meta?.hot_posts} />
              </div>
            )}

            <div className="forum-feed">
                {feedLoading && (
                  <div className="forum-feed-loading" aria-busy="true" aria-live="polite">
                    <MoonLoading label="正在載入貼文…" variant="inline" centered calm size={58} />
                  </div>
                )}

                {!feedLoading && showWelcomeCard && <WelcomeCard topic={topic} />}

                {!feedLoading && loadError && (
                  <div className="forum-feed-error" role="alert">
                    <p className="forum-feed-error__text">貼文載入失敗，請稍後再試。</p>
                    <button type="button" className="pixel-btn forum-feed-error__retry" onClick={() => load(true, { bootstrap: true, feedOnly: true })}>
                      重新載入
                    </button>
                  </div>
                )}

                {!feedLoading && showEmptyState && (
                  <EmptyState
                    topic={topic}
                    onCompose={openCompose}
                    canCompose={!!session}
                    sort={sort}
                    viewerClanType={viewerClanType}
                  />
                )}

                {!feedLoading && feedPosts.length > 0 && (
                  <ul className="pixel-list">
                    {feedPosts.map((post) => (
                      <li key={post.id}>
                        <article className="pixel-post-card">
                          {session && (
                            <button
                              type="button"
                              className={`pixel-post-card__bookmark${post.viewer_bookmarked ? ' pixel-post-card__bookmark--active' : ''}`}
                              title={post.viewer_bookmarked ? '已收藏' : '收藏'}
                              aria-label={post.viewer_bookmarked ? '已收藏' : '收藏'}
                              aria-pressed={!!post.viewer_bookmarked}
                              disabled={bookmarkingIds.has(post.id)}
                              onClick={(e) => toggleBookmark(post.id, e)}
                            >
                              <span aria-hidden="true">🔖</span>
                            </button>
                          )}
                          <Link
                            href={
                              post.members_gated && !session
                                ? `/login?redirect=/forum/${encodeURIComponent(post.id)}`
                                : `/forum/${post.id}`
                            }
                            className={`pixel-post-card__link${post.members_gated ? ' pixel-post-card__link--gated' : ''}`}
                          >
                            <div style={{ display: 'flex', gap: 8, marginBottom: 6, paddingRight: 36 }}>
                              <span
                                className="pixel-tag"
                                style={{
                                  color: TOPIC_STYLES[displayTopic(post.topic)]?.accent || 'var(--purple-light)',
                                  borderColor: `${TOPIC_STYLES[displayTopic(post.topic)]?.accent || '#bd93f9'}55`,
                                }}
                              >
                                {displayTopic(post.topic)}
                              </span>
                              <ForumPostTags
                                tags={post.tags}
                                tagLabels={tagLabels}
                                officialTagKeys={getOfficialTagKeysForTopic(displayTopic(post.topic))}
                                variant="compact"
                                activeTag={activeTag}
                                onTagClick={(tag) => setActiveTag((prev) => (prev === tag ? null : tag))}
                              />
                              {post.visibility === 'members_only' && (
                                <span className="forum-visibility-badge">🔒 會員限定</span>
                              )}
                              {post.is_pinned && (
                                <span className="forum-visibility-badge">📌 圍爐置頂</span>
                              )}
                              {post.is_highlighted && (
                                <span className="forum-visibility-badge">✨ 月光加冕</span>
                              )}
                            </div>
                            {post.title && <h3 className="pixel-post-title">{post.title}</h3>}
                            <p className="pixel-post-content">
                              {post.content}
                            </p>
                            <div className="pixel-post-footer">
                              <span className="pixel-post-footer__author">
                                <ForumAuthorName
                                  name={post.anonymous_name_snapshot}
                                  isMine={post.is_mine}
                                  isPremium={post.author_is_premium}
                                  mirrorSlug={post.author_mirror_slug}
                                  onLinkClick={(e) => e.stopPropagation()}
                                />
                              </span>
                              <span className="pixel-post-footer__stats">
                                💗 {post.like_count} · 💬 {post.comment_count}
                              </span>
                              <span>{timeAgo(post.created_at)}</span>
                            </div>
                          </Link>
                        </article>
                      </li>
                    ))}
                  </ul>
                )}

                {!feedLoading && !session && !loadError && (
                  <div className="forum-guest-cta">
                    <p className="forum-guest-cta__text">想留言或發文？登入後即可參與圍爐。</p>
                    <Link href="/login?redirect=/forum" className="forum-guest-cta__btn">
                      登入參與討論
                    </Link>
                  </div>
                )}

            {hasMore && !feedLoading && (
              <button type="button" onClick={() => load(false)} className="pixel-btn pixel-btn--ghost" style={{ margin: '0 auto' }}>
                載入更多
              </button>
            )}
            </div>
          </div>

          <div className="forum-sidebar forum-sidebar--right">
            <FeaturedPostsPanel featuredPosts={featuredPosts} />
            <HotTopicsPanel hotPosts={meta?.hot_posts} />
          </div>
          <div className="forum-scroll-end" data-scroll-end aria-hidden="true" />
        </div>

        {showBookmarks && (
          <ForumBookmarksPanel
            open={showBookmarks}
            onClose={() => setShowBookmarks(false)}
            accessToken={session?.access_token}
            onBookmarkChange={handleBookmarkChange}
          />
        )}

        <ForumMatureGate
          open={showMatureGate}
          session={session}
          loginRedirect="/forum"
          onAcknowledged={handleMatureAcknowledged}
          onDismiss={handleMatureDismiss}
        />

        {showCompose && (
        <ForumComposeOverlay onClose={closeCompose}>
              <div className="forum-compose-modal__head">
                <h2 id="forum-compose-title" className="forum-compose-modal__title">新貼文</h2>
                {isPremium && (
                  <HeaderPremiumMoon profile={profile} className="forum-compose-premium-tag__moon" />
                )}
              </div>
              {draftNotice && (
                <p className="forum-compose-draft-notice" role="status">{draftNotice}</p>
              )}
              <form onSubmit={handleSubmit} className="pixel-form">
                <select
                  value={form.topic}
                  onChange={(e) => {
                    const nextTopic = e.target.value;
                    setForm((f) => ({
                      ...f,
                      topic: nextTopic,
                      visibility: isMatureForumTopic(nextTopic) ? 'members_only' : f.visibility,
                    }));
                  }}
                  className="pixel-select"
                >
                  {FORUM_TOPICS.filter((t) => t !== '全部').map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ForumTagField
                  tags={form.tags}
                  topic={form.topic}
                  onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                  disabled={submitting}
                />
                <input
                  placeholder="標題（可選）"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={100}
                  className="pixel-input"
                />
                {isMatureForumTopic(form.topic) ? (
                  <div className="forum-mature-compose-notice" role="note">
                    <p className="forum-mature-compose-notice__title">親密話題發文須知</p>
                    <ul className="forum-mature-compose-notice__rules">
                      {MATURE_POST_RULES_SUMMARY.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                    <p className="forum-visibility-field__hint">此版貼文一律為會員限定，不會出現在公開首頁。</p>
                  </div>
                ) : (
                <fieldset className="forum-visibility-field">
                  <legend className="forum-visibility-field__legend">可見範圍</legend>
                  <div className="forum-visibility-field__options">
                    <label className={`forum-visibility-option${form.visibility === 'public' ? ' forum-visibility-option--active' : ''}`}>
                      <input
                        type="radio"
                        name="forum-visibility"
                        value="public"
                        checked={form.visibility === 'public'}
                        onChange={() => setForm((f) => ({ ...f, visibility: 'public' }))}
                      />
                      <span>🌍 公開</span>
                    </label>
                    <label className={`forum-visibility-option${form.visibility === 'members_only' ? ' forum-visibility-option--active' : ''}`}>
                      <input
                        type="radio"
                        name="forum-visibility"
                        value="members_only"
                        checked={form.visibility === 'members_only'}
                        onChange={() => setForm((f) => ({ ...f, visibility: 'members_only' }))}
                      />
                      <span>🔒 會員限定</span>
                    </label>
                  </div>
                  {form.visibility === 'members_only' && (
                    <p className="forum-visibility-field__hint">會員限定貼文僅登入用戶可閱讀，未登入者不會在列表看到。</p>
                  )}
                </fieldset>
                )}
                <ForumComposeField
                  value={form.content}
                  onChange={(content) => setForm((f) => ({ ...f, content }))}
                  polls={form.polls}
                  onPollsChange={(polls) => setForm((f) => ({ ...f, polls }))}
                  accessToken={session?.access_token}
                  maxLength={2000}
                  minRows={5}
                  placeholder="說說你想說的…（10–2000 字）"
                  required
                  disabled={submitting}
                />
                {submitError && <p className="pixel-error">{submitError}</p>}
                <div className="forum-compose-actions">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeCompose();
                    }}
                    className="forum-compose-actions__cancel"
                  >
                    取消
                  </button>
                  <button type="submit" disabled={submitting} className="forum-compose-actions__submit">
                    {submitting ? '發送中…' : '發文'}
                  </button>
                </div>
              </form>
        </ForumComposeOverlay>
        )}
      </AppShell>
      {bookmarkToast && (
        <div className="forum-bookmark-whisper" role="status" aria-live="polite">
          <p className="forum-bookmark-whisper__text">
            <span className="forum-bookmark-whisper__glyph" aria-hidden="true">
              {bookmarkToast === 'saved' ? '🔖' : '✦'}
            </span>
            {bookmarkToast === 'saved' ? '已收入書櫃' : '已從書櫃取下'}
          </p>
        </div>
      )}
    </>
  );
}
