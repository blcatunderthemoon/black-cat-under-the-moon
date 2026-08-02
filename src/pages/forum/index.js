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
import { isPremiumUser } from '../../lib/premium.js';
import ForumCampfireGlow from '../../components/ForumCampfireGlow.js';
import SeoHead from '../../components/SeoHead.js';
import { organizationJsonLd, webSiteJsonLd } from '../../lib/structured-data.js';
import {
  FORUM_TOPICS,
  TOPIC_STYLES,
  FORUM_DISPLAY_NAME,
  getEmptyStateCopy,
  displayTopic,
  forumTopicLabel,
} from '../../lib/forum-welcome.js';
import ForumWelcomeCard, { canEditWelcomeTopic } from '../../components/ForumWelcomeCard.js';
import {
  getOfficialTagKeysForTopic,
  mergePresetTagsWithCounts,
  RETIRED_FORUM_TAG_KEYS,
} from '../../lib/forum-categories.js';
import MirrorFamilyBadge from '../../components/MirrorFamilyBadge.js';
import ForumComposeField from '../../components/ForumComposeField.js';
import ForumComposeOverlay from '../../components/ForumComposeOverlay.js';
import ForumTagField from '../../components/ForumTagField.js';
import ForumStoryBookshelf from '../../components/ForumStoryBookshelf.js';
import ForumStorySearchBar from '../../components/ForumStorySearchBar.js';
import ForumStoryComposeFields from '../../components/ForumStoryComposeFields.js';
import ForumPostTags from '../../components/ForumPostTags.js';
import ForumCommunityActivities, { scrollForumHotPanelIntoView } from '../../components/ForumCommunityActivities.js';
import { formatForumTagLabel, canonicalForumTagKey } from '../../lib/forum-tags.js';
import { isStoryTopic, isStoryPost, storyFeedPreviewText, STORY_CONTENT_MAX } from '../../lib/forum-story.js';
import { STORY_CHAPTER_TITLE_MAX } from '../../lib/forum-story-chapters.js';
import {
  clearForumDraft,
  FORUM_POST_DRAFT_KEY,
  readForumDraft,
  hasForumPostDraftContent,
  persistForumPostDraft,
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
  resolveMatureGateAck,
  fetchMatureGateAck,
} from '../../lib/forum-mature.js';
import ForumHorizontalScroll from '../../components/ForumHorizontalScroll.js';
import ForumBannerTicker from '../../components/ForumBannerTicker.js';
import {
  ForumTopicIcon,
  ForumSortIcon,
  ForumLikeStat,
  ForumCommentStat,
  ForumPinIcon,
  ForumSparkleIcon,
  ForumMoonIcon,
  ForumTrophyIcon,
  ForumFlameIcon,
  ForumBookIcon,
  ForumLockIcon,
  HeaderBookmarkIcon,
} from '../../components/ForumIcons.js';

const SORT_OPTIONS = [
  { id: 'latest', label: '最新', hint: '依發文時間由新到舊' },
  { id: 'popular', label: '熱門', hint: '依愛心數由高到低' },
  { id: 'clan', label: '同族', hint: '同家族的貼文', authOnly: true },
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
          <p className="forum-empty__subline">完成 Mirror 測驗後，就能在同族模式找到氣場相近的貓咪</p>
          <Link href="/mirror.html" className="forum-empty__cta">
            開始 Mirror 測驗
          </Link>
        </>
      ) : isClanEmpty ? (
        <>
          <h2 className="forum-empty__headline">同族暫時未有貼文</h2>
          <p className="forum-empty__subline forum-empty__subline--inline">
            <MirrorFamilyBadge type={viewerClanType} variant="compact" className="forum-empty__clan-badge" />
            <span className="forum-empty__subline-text">的貓咪還沒開口，來點第一把火吧</span>
          </p>
          <button type="button" className="forum-empty__cta" onClick={onCompose}>
            立刻發文
          </button>
        </>
      ) : (
        <>
          <h2 className="forum-empty__headline">{copy.headline}</h2>
          <p className="forum-empty__subline">{copy.subline}</p>
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

function FeaturedPostsPanel({ featuredPosts }) {
  if (!featuredPosts?.length) return null;

  return (
    <aside className="forum-panel forum-panel--featured">
      <div className="forum-panel__head">
        <h3 className="forum-panel__title">
          <ForumSparkleIcon size={14} className="forum-panel__title-icon" />
          {' '}月光精選
        </h3>
        <p className="forum-panel__hint forum-panel__hint--hot">版主加冕的優質文章</p>
      </div>
      <ol className="forum-hot-list">
        {featuredPosts.map((p) => (
          <li key={p.id}>
            <Link href={`/forum/${p.id}`} className="forum-hot-item forum-hot-item--crowned">
              <div className="forum-hot-item__body">
                <p className="forum-hot-item__title">{p.title || p.topic}</p>
                <span className="forum-hot-item__meta">
                  <span className="forum-hot-item__topic">{forumTopicLabel(p.topic)}</span>
                  <span className="forum-hot-item__stats">
                    <ForumLikeStat count={p.like_count} />
                    <ForumCommentStat count={p.comment_count} />
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

function HotTopicsPanel({ hotPosts, sparksMode }) {
  const rankMods = ['forum-hot-item--gold', 'forum-hot-item--silver', 'forum-hot-item--bronze'];
  const curated = sparksMode === 'curated';
  const title = curated ? '週度精選' : '活躍火種';
  const TitleIcon = curated ? ForumSparkleIcon : ForumFlameIcon;
  const hint = curated ? '官方推薦' : '本週最活躍 TOP 3';
  const curatedIcons = [ForumPinIcon, ForumSparkleIcon, ForumMoonIcon];

  if (!hotPosts?.length) {
    // Last-resort UI: still never announce a dead week
    return (
      <aside data-forum-hot-panel className="forum-panel forum-panel--hot forum-panel--hot-reveal">
        <div className="forum-panel__head">
          <h3 className="forum-panel__title">
            <ForumSparkleIcon size={14} className="forum-panel__title-icon" />
            {' '}週度精選
          </h3>
          <p className="forum-panel__hint forum-panel__hint--hot">官方推薦</p>
        </div>
        <p className="forum-hot-empty forum-hot-empty--soft">
          圍爐正暖著爐火——去發一篇，成為下一顆火種吧。
        </p>
      </aside>
    );
  }

  return (
    <aside data-forum-hot-panel className="forum-panel forum-panel--hot forum-panel--hot-reveal">
      <div className="forum-panel__head">
        <h3 className="forum-panel__title">
          <TitleIcon size={14} className="forum-panel__title-icon" />
          {' '}{title}
        </h3>
        <p className="forum-panel__hint forum-panel__hint--hot">{hint}</p>
      </div>
      <ol className="forum-hot-list">
        {hotPosts.map((p, index) => {
          const RankIcon = curated
            ? (curatedIcons[index] || ForumSparkleIcon)
            : ForumTrophyIcon;
          return (
            <li key={p.id} style={{ '--hot-i': index }}>
              <Link
                href={`/forum/${p.id}`}
                className={`forum-hot-item${rankMods[index] ? ` ${rankMods[index]}` : ''}${curated ? ' forum-hot-item--curated' : ''}`}
              >
                <span className="forum-hot-item__rank" aria-label={`第 ${index + 1} 名`}>
                  <RankIcon size={14} place={index + 1} />
                </span>
                <div className="forum-hot-item__body">
                  <p className="forum-hot-item__title">{p.title || p.topic}</p>
                  <span className="forum-hot-item__meta">
                    <span className="forum-hot-item__topic">{forumTopicLabel(p.topic) || p.topic}</span>
                    <span className="forum-hot-item__stats">
                      <ForumLikeStat count={p.like_count} />
                      <ForumCommentStat count={p.comment_count} />
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
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
  const { session, profile, refreshProfile, loading: authLoading } = useAuth();
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
  const [forumReady, setForumReady] = useState(false);
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [storySearchLoading, setStorySearchLoading] = useState(false);
  const [matureAcked, setMatureAcked] = useState(false);
  const [storySearch, setStorySearch] = useState('');
  const [storySearchDebounced, setStorySearchDebounced] = useState('');
  const [showHotPanel, setShowHotPanel] = useState(false);
  const topicRef = useRef(topic);
  const topicsRowRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const deepLinkAppliedRef = useRef(false);
  const filterSnapshotRef = useRef({ topic, sort, activeTag, storySearchDebounced });

  const defaultTopic = topic === '全部' ? '社群' : topic;
  const [form, setForm] = useState({
    title: '',
    content: '',
    topic: defaultTopic,
    tags: [],
    visibility: 'public',
    hide_username: false,
    polls: [],
    cover_image_url: '',
    synopsis: '',
    chapter_one_title: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const offsetRef = useRef(0);
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

  const markForumReady = useCallback(() => {
    initialLoadDoneRef.current = true;
    setForumReady(true);
    setPageBootstrapping(false);
    setFeedRefreshing(false);
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
  const serverMatureAck = !!profile?.profile?.forum_mature_acknowledged;
  const showMatureGate = matureTopicActive && (!session || !matureAcked);

  useEffect(() => {
    if (!matureTopicActive) return undefined;
    const userId = session?.user?.id;
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
  }, [matureTopicActive, topic, session?.user?.id, session?.access_token, serverMatureAck]);

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
    if (topic === '全部') {
      return (meta?.hot_tags || []).filter(
        (h) => h?.tag && !RETIRED_FORUM_TAG_KEYS.has(canonicalForumTagKey(h.tag))
      );
    }
    // Topic selected: fold community tags into the official 標籤 row (one scroll on mobile).
    return meta?.user_hot_tags || [];
  }, [topic, meta, metaMatchesTopic]);

  const topicFilterTagsDisplay = useMemo(() => {
    if (topic === '全部' || isStoryTopic(topic)) return [];
    const seen = new Set(presetTagsDisplay.map((t) => t.tag));
    const extras = userHotTagsDisplay
      .filter((h) => h?.tag && !seen.has(h.tag) && !RETIRED_FORUM_TAG_KEYS.has(canonicalForumTagKey(h.tag)))
      .map((h) => ({
        tag: h.tag,
        display_label: h.display_label || h.tag,
        count: h.count || 0,
        official: false,
      }));
    const base = [...presetTagsDisplay, ...extras];
    if (activeTag && !base.some((t) => t.tag === activeTag)) {
      return [{ tag: activeTag, display_label: tagLabels[activeTag] || activeTag, count: 0, official: false }, ...base];
    }
    return base;
  }, [topic, presetTagsDisplay, userHotTagsDisplay, activeTag, tagLabels]);

  useEffect(() => {
    if (!isStoryTopic(topic)) {
      setStorySearch('');
      setStorySearchDebounced('');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setStorySearchDebounced(storySearch.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [storySearch, topic]);

  const load = useCallback(async (reset = false, { bootstrap = false, silent = false, feedOnly = false, postsOnly = false, searchOnly = false } = {}) => {
    const seq = ++loadSeqRef.current;
    const newOffset = reset ? 0 : offsetRef.current;
    const requestedTopic = topic;
    const topicParam = topic === '全部' ? '' : `&topic=${encodeURIComponent(topic)}`;
    const tagParam = activeTag ? `&tag=${encodeURIComponent(activeTag)}` : '';
    const searchParam = isStoryTopic(topic) && storySearchDebounced
      ? `&q=${encodeURIComponent(storySearchDebounced)}`
      : '';
    const headers = {};
    const token = sessionRef.current?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;

    if (searchOnly) {
      setStorySearchLoading(true);
    } else if (bootstrap) {
      if (!silent) {
        if (feedOnly || initialLoadDoneRef.current) {
          setPageBootstrapping(false);
          setFeedRefreshing(true);
        } else {
          setPageBootstrapping(true);
        }
      }
      if (reset && !silent && !feedOnly) setPosts(null);
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
          `/api/forum/posts?sort=${sort}&limit=20&offset=0${topicParam}${tagParam}${searchParam}`,
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
        const r = await fetch(`/api/forum/posts?sort=${sort}&limit=20&offset=${newOffset}${topicParam}${tagParam}${searchParam}`, { headers });
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
      if (seq === loadSeqRef.current) {
        if (searchOnly) {
          setStorySearchLoading(false);
        }
        if (bootstrap || reset) {
          markForumReady();
        }
        loadedWithTokenRef.current = sessionRef.current?.access_token ?? null;
      }
    }
  }, [topic, sort, activeTag, storySearchDebounced, fetchMeta, applyMetaPayload, markForumReady]);

  const handleMatureAcknowledged = useCallback(() => {
    setMatureAcked(true);
    refreshProfile?.({ force: true });
    clearForumFeedCache();
    load(true, { bootstrap: true, feedOnly: initialLoadDoneRef.current });
  }, [load, refreshProfile]);

  const handleMatureDismiss = useCallback(() => {
    setActiveTag(null);
    setTopic('全部');
  }, []);

  const selectTopic = useCallback((nextTopic) => {
    if (nextTopic === topicRef.current) return;
    if (initialLoadDoneRef.current) {
      setPageBootstrapping(false);
    }
    setActiveTag(null);
    setTopic(nextTopic);
  }, []);

  useEffect(() => {
    const prev = filterSnapshotRef.current;
    const topicChanged = prev.topic !== topic;
    const sortChanged = prev.sort !== sort;
    const tagChanged = prev.activeTag !== activeTag;
    const searchChanged = prev.storySearchDebounced !== storySearchDebounced;
    filterSnapshotRef.current = { topic, sort, activeTag, storySearchDebounced };

    const postsOnly = initialLoadDoneRef.current
      && !topicChanged
      && (tagChanged || sortChanged || searchChanged);
    const searchOnly = initialLoadDoneRef.current
      && searchChanged
      && !topicChanged
      && !sortChanged
      && !tagChanged;

    offsetRef.current = 0;
    setOffset(0);
    setLoadError(false);

    if (isMatureForumTopic(topic)) {
      const acked = resolveMatureGateAck(
        sessionRef.current?.user?.id,
        !!profile?.profile?.forum_mature_acknowledged,
      );
      setMatureAcked(acked);
      if (!sessionRef.current || !acked) {
        setPosts([]);
        setHasMore(false);
        markForumReady();
        return;
      }
    }

    if (searchOnly) {
      load(true, { bootstrap: false, silent: true, postsOnly: true, searchOnly: true });
      return;
    }

    const cached = !storySearchDebounced && readForumFeedCache(sort, topic, activeTag);
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
      markForumReady();
      load(true, { bootstrap: false, silent: true, postsOnly });
    } else {
      load(true, {
        bootstrap: true,
        feedOnly: initialLoadDoneRef.current,
        postsOnly,
      });
    }
  }, [topic, sort, activeTag, storySearchDebounced, load, profile?.profile?.forum_mature_acknowledged, markForumReady]);

  useEffect(() => {
    if (authLoading) return;
    if (pageBootstrapping) return;
    const token = session?.access_token ?? null;
    if (loadedWithTokenRef.current === token) return;
    if (posts === null) return;
    load(true, { bootstrap: false, silent: true });
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
    if (!posts || pageBootstrapping || storySearchDebounced) return;
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
  }, [posts, meta, featuredPosts, metaTopic, tagLabels, viewerClanType, hasMore, pageBootstrapping, sort, topic, activeTag, storySearchDebounced]);

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

  /* Deep links from banner hit topics: /forum?topic=徵友&tag=…&compose=1 */
  useEffect(() => {
    if (!router.isReady || deepLinkAppliedRef.current) return;
    deepLinkAppliedRef.current = true;

    const qTopic = typeof router.query.topic === 'string' ? router.query.topic.trim() : '';
    const qTag = typeof router.query.tag === 'string' ? router.query.tag.trim() : '';
    const wantCompose = router.query.compose === '1' || router.query.compose === 'true';
    const resolvedTopic = FORUM_TOPICS.includes(qTopic) && qTopic !== '全部' ? qTopic : null;
    const tagKey = qTag ? canonicalForumTagKey(qTag) : null;

    if (resolvedTopic) {
      setTopic(resolvedTopic);
      topicRef.current = resolvedTopic;
    }
    if (tagKey) setActiveTag(tagKey);

    if (!wantCompose) return;

    const nextTopic = resolvedTopic || '社群';
    setForm({
      title: '',
      content: '',
      topic: nextTopic,
      tags: tagKey ? [tagKey] : [],
      visibility: isMatureForumTopic(nextTopic) ? 'members_only' : 'public',
      hide_username: false,
      polls: [],
      cover_image_url: '',
      synopsis: '',
      chapter_one_title: '',
    });
    setDraftNotice('');
    setShowCompose(true);
  }, [router.isReady, router.query]);

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
        : (draft?.visibility || 'public'),
      hide_username: !!draft?.hide_username,
      polls: Array.isArray(draft?.polls) ? draft.polls : [],
      cover_image_url: draft?.cover_image_url || '',
      synopsis: draft?.synopsis || '',
      chapter_one_title: draft?.chapter_one_title || '',
    });
    setDraftNotice(draft?.savedAt ? '已恢復草稿' : '');
    setShowCompose(true);
  }

  useEffect(() => {
    if (!showCompose) return undefined;
    const timer = setInterval(() => {
      if (!hasForumPostDraftContent(form)) return;
      persistForumPostDraft(form);
      setDraftNotice('草稿已自動儲存');
    }, 3000);
    return () => clearInterval(timer);
  }, [showCompose, form]);

  function resetComposeForm() {
    setForm({
      title: '',
      content: '',
      topic: topic === '全部' ? '社群' : topic,
      tags: [],
      visibility: 'public',
      hide_username: false,
      polls: [],
      cover_image_url: '',
      synopsis: '',
      chapter_one_title: '',
    });
  }

  function closeCompose() {
    clearForumDraft(FORUM_POST_DRAFT_KEY);
    resetComposeForm();
    setSubmitError('');
    setDraftNotice('');
    setShowCompose(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!session?.access_token) {
      setSubmitError('請先登入後再發文。');
      return;
    }
    if (!form.content.trim()) { setSubmitError('請填寫內容。'); return; }
    if (isStoryTopic(form.topic) && !form.title.trim()) {
      setSubmitError('故事需要標題。');
      return;
    }
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
        hide_username: false,
        polls: [],
        cover_image_url: '',
        synopsis: '',
        chapter_one_title: '',
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
  const shellLoading = !forumReady;
  const feedInitialLoading = forumReady && posts === null && !feedRefreshing;
  const feedLoading = feedRefreshing || feedInitialLoading;
  const isEmpty = !feedLoading && Array.isArray(posts) && posts.length === 0;
  const feedPosts = posts || [];
  const showEmptyState = isEmpty && !loadError;
  const showWelcomeCard = topic !== '全部' && sort !== 'clan' && !loadError && !feedLoading;
  const canEditWelcome = canEditWelcomeTopic(profile, topic);
  const showRightSidebar = (Array.isArray(featuredPosts) && featuredPosts.length > 0) || showHotPanel;

  if (shellLoading) {
    return (
      <>
        <SeoHead
          title={FORUM_DISPLAY_NAME}
          description="香港Les討論區・黑貓樹洞 — 香港女同志匿名分享同交流，認識同路朋友。"
          path="/forum"
          jsonLd={[organizationJsonLd(), webSiteJsonLd()]}
        />
        <PageLoadingShell
          pageClassName="app-page--forum"
          loadingSmooth
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
        title={matureTopicActive ? `${MATURE_FORUM_TOPIC} · ${FORUM_DISPLAY_NAME}` : `${FORUM_DISPLAY_NAME}｜香港Les討論區`}
        description={matureTopicActive
          ? '黑貓樹洞成熟話題版 — 已登入會員的文字討論空間，分享親密關係、同意同界線。'
          : '香港Les討論區｜黑貓樹洞 — 香港女同志匿名分享心情、交流同認識同路朋友。'}
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
            moonJourney={null}
            extra={
              session ? (
                <button type="button" className="forum-compose-btn" onClick={openCompose}>
                  + 發文
                </button>
              ) : null
            }
          />
        }
      >
        <div className="forum-layout">
          <div className="forum-main">
            <ForumBannerTicker />

            <div className="forum-filters-panel forum-panel">
              <div className="forum-filters-panel__topics">
              <ForumHorizontalScroll
                ref={topicsRowRef}
                className="pixel-filter-row pixel-filter-row--topics"
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
                    aria-label={t === MATURE_FORUM_TOPIC ? '親密話題 18+' : undefined}
                  >
                    {t === MATURE_FORUM_TOPIC ? (
                      <span className="forum-topic-badge__mature-inner">
                        <span className="forum-topic-badge__mature-label">
                          <span className="forum-topic-badge__mature-moon" aria-hidden="true">
                            <ForumTopicIcon topic={t} size={13} />
                          </span>
                          親密
                        </span>
                        <span className="forum-topic-badge__age" aria-hidden="true">18+</span>
                      </span>
                    ) : (
                      <>
                        <ForumTopicIcon topic={t} size={13} className="forum-topic-badge__icon" />
                        {' '}{forumTopicLabel(t)}
                      </>
                    )}
                  </button>
                ))}
              </ForumHorizontalScroll>
              </div>

              <div className="forum-filters-panel__tools">
              {(topic !== '全部' && !isStoryTopic(topic) && topicFilterTagsDisplay.length > 0) && (
                <div className="forum-preset-tags-row" role="group" aria-label="官方標籤">
                  <span className="forum-preset-tags-row__label">標籤</span>
                  <ForumHorizontalScroll className="forum-preset-tags-row__scroll">
                    {topicFilterTagsDisplay.map(({ tag, display_label: displayLabel, count, official }) => {
                      const isActive = activeTag === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`forum-tag-chip${official ? ' forum-tag-chip--preset forum-tag-chip--official' : ' forum-tag-chip--hot'}${isActive ? ' forum-tag-chip--active' : ''}`}
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
                  </ForumHorizontalScroll>
                </div>
              )}

              {topic === '全部' && userHotTagsDisplay.length > 0 && !isStoryTopic(topic) && (
                <div className="forum-hot-tags-row" role="group" aria-label="熱門標籤">
                  <span className="forum-hot-tags-row__label">熱門</span>
                  <ForumHorizontalScroll className="forum-hot-tags-row__scroll">
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
                  </ForumHorizontalScroll>
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
                      <span className="forum-sort-badge__icon" aria-hidden="true">
                        <ForumSortIcon sortId={o.id} size={13} />
                      </span>
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
            </div>

            <ForumCommunityActivities
              onRankClick={() => {
                setShowHotPanel(true);
                window.setTimeout(() => {
                  if (scrollForumHotPanelIntoView()) return;
                  if (topic !== '全部') selectTopic('全部');
                  window.setTimeout(() => scrollForumHotPanelIntoView(), 120);
                }, 40);
              }}
            />

            {topic === '全部' && (
              <>
                <div className="forum-treehole-panels forum-treehole-panels--mobile">
                  <FeaturedPostsPanel featuredPosts={featuredPosts} />
                  {showHotPanel && (
                    <HotTopicsPanel hotPosts={meta?.hot_posts} sparksMode={meta?.sparks_mode} />
                  )}
                </div>
              </>
            )}

            <div className={`forum-feed${feedRefreshing ? ' forum-feed--refreshing' : ''}`}>
                {feedRefreshing && (
                  <div className="forum-feed-loading forum-feed-loading--overlay" aria-busy="true" aria-live="polite">
                    <MoonLoading
                      variant="hero"
                      centered
                      className="forum-feed-loading__moon page-loading"
                    />
                  </div>
                )}

                {feedInitialLoading && (
                  <div className="forum-feed-loading" aria-busy="true" aria-live="polite">
                    <MoonLoading
                      variant="hero"
                      centered
                      className="forum-feed-loading__moon page-loading"
                    />
                  </div>
                )}

                {isStoryTopic(topic) && posts !== null && (
                  <ForumStorySearchBar
                    value={storySearch}
                    onChange={setStorySearch}
                    onClear={() => setStorySearch('')}
                    disabled={storySearchLoading}
                  />
                )}

                {!feedLoading && showWelcomeCard && (
                  <ForumWelcomeCard
                    topic={topic}
                    canEdit={canEditWelcome}
                    accessToken={session?.access_token}
                  />
                )}

                {!feedLoading && loadError && (
                  <div className="forum-feed-error" role="alert">
                    <p className="forum-feed-error__text">貼文載入失敗，請稍後再試。</p>
                    <button type="button" className="pixel-btn forum-feed-error__retry" onClick={() => load(true, { bootstrap: true, feedOnly: true })}>
                      重新載入
                    </button>
                  </div>
                )}

                {isStoryTopic(topic) && posts !== null && (
                  <div className="forum-story-bookshelf-zone" aria-busy={storySearchLoading}>
                    {storySearchLoading ? (
                      <div className="forum-story-bookshelf-loading" aria-live="polite">
                        <MoonLoading variant="inline" centered size={40} />
                      </div>
                    ) : (
                      <>
                        {storySearchDebounced && feedPosts.length === 0 && !loadError && (
                          <div className="forum-story-search-empty" role="status">
                            找不到「{storySearchDebounced}」相關書名
                          </div>
                        )}

                        {showEmptyState && !storySearchDebounced && (
                          <EmptyState
                            topic={topic}
                            onCompose={openCompose}
                            canCompose={!!session}
                            sort={sort}
                            viewerClanType={viewerClanType}
                          />
                        )}

                        {feedPosts.length > 0 && (
                          <ForumStoryBookshelf
                            posts={feedPosts}
                            session={session}
                            bookmarkingIds={bookmarkingIds}
                            onBookmark={toggleBookmark}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}

                {!feedLoading && showEmptyState && !isStoryTopic(topic) && (
                  <EmptyState
                    topic={topic}
                    onCompose={openCompose}
                    canCompose={!!session}
                    sort={sort}
                    viewerClanType={viewerClanType}
                  />
                )}

                {!feedLoading && feedPosts.length > 0 && !isStoryTopic(topic) && (
                  <ul className="pixel-list">
                    {feedPosts.map((post) => (
                      <li key={post.id}>
                        <article className={`pixel-post-card${post.is_highlighted ? ' pixel-post-card--crowned' : (post.is_pinned ? ' pixel-post-card--pinned' : '')}`}>
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
                              <span aria-hidden="true"><HeaderBookmarkIcon size={14} /></span>
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
                                {forumTopicLabel(post.topic)}
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
                                <span className="forum-visibility-badge">
                                  <ForumLockIcon size={11} /> 會員限定
                                </span>
                              )}
                              {post.hide_username && (
                                <span className="forum-visibility-badge">匿名</span>
                              )}
                              {post.is_pinned && (
                                <span className="forum-visibility-badge">
                                  <ForumPinIcon size={11} /> 圍爐置頂
                                </span>
                              )}
                              {post.is_highlighted && (
                                <span className="forum-crown-badge" aria-label="月光加冕">
                                  <span className="forum-crown-badge__sigil" aria-hidden="true">
                                    <ForumSparkleIcon size={12} />
                                  </span>
                                  <span className="forum-crown-badge__text">月光加冕</span>
                                </span>
                              )}
                            </div>
                            {post.title && <h3 className="pixel-post-title">{post.title}</h3>}
                            {(() => {
                              const preview = isStoryPost(post)
                                ? storyFeedPreviewText(post, 160)
                                : post.content;
                              return preview ? (
                                <p className="pixel-post-content">{preview}</p>
                              ) : null;
                            })()}
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
                                <ForumLikeStat count={post.like_count} />
                                <ForumCommentStat count={post.comment_count} />
                              </span>
                              <span className="pixel-post-footer__time">{timeAgo(post.created_at)}</span>
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

            {!hasMore && !feedLoading && !loadError && Array.isArray(posts) && posts.length > 0 && (
              <p className="forum-feed-end" role="status">
                <span className="forum-feed-end__line" aria-hidden="true" />
                <span className="forum-feed-end__text">已經到盡頭了 · 暫時未有新貼文</span>
                <span className="forum-feed-end__line" aria-hidden="true" />
              </p>
            )}
            </div>
          </div>

          {showRightSidebar && (
            <div className="forum-sidebar forum-sidebar--right">
              <FeaturedPostsPanel featuredPosts={featuredPosts} />
              {showHotPanel && (
                <HotTopicsPanel hotPosts={meta?.hot_posts} sparksMode={meta?.sparks_mode} />
              )}
            </div>
          )}
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
        <ForumComposeOverlay
          modalClassName={isStoryTopic(form.topic) ? 'forum-compose-modal--story' : ''}
        >
              <button
                type="button"
                className="forum-compose-modal__close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeCompose();
                }}
                aria-label="關閉並捨棄草稿"
              >
                ×
              </button>
              <div className={`forum-compose-modal__head${isStoryTopic(form.topic) ? ' forum-compose-modal__head--story' : ''}`}>
                <div className="forum-compose-modal__head-copy">
                  {isStoryTopic(form.topic) && (
                    <p className="forum-compose-modal__eyebrow">
                      <ForumBookIcon size={13} /> 黑貓書櫃
                    </p>
                  )}
                  <h2 id="forum-compose-title" className="forum-compose-modal__title">
                    {isStoryTopic(form.topic) ? '新故事' : '新貼文'}
                  </h2>
                  {isStoryTopic(form.topic) && (
                    <p className="forum-compose-modal__subtitle">放上封面與簡介，讓讀者從書櫃翻開你的故事</p>
                  )}
                </div>
              </div>
              {draftNotice && (
                <p className="forum-compose-draft-notice" role="status">{draftNotice}</p>
              )}
              <form onSubmit={handleSubmit} className={`pixel-form${isStoryTopic(form.topic) ? ' forum-compose-form--story' : ''}`}>
                <label className="forum-compose-form__field">
                  <span className="forum-compose-form__label">分類</span>
                  <select
                    value={form.topic}
                    onChange={(e) => {
                      const nextTopic = e.target.value;
                      setForm((f) => ({
                        ...f,
                        topic: nextTopic,
                        visibility: isMatureForumTopic(nextTopic) ? 'members_only' : f.visibility,
                        hide_username: isStoryTopic(nextTopic) ? false : f.hide_username,
                        tags: isStoryTopic(nextTopic) ? [] : f.tags,
                      }));
                    }}
                    className="pixel-select"
                  >
                    {FORUM_TOPICS.filter((t) => t !== '全部').map((t) => (
                      <option key={t} value={t}>{forumTopicLabel(t)}</option>
                    ))}
                  </select>
                </label>
                {!isStoryTopic(form.topic) && (
                <ForumTagField
                  tags={form.tags}
                  topic={form.topic}
                  onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                  disabled={submitting}
                />
                )}
                <label className="forum-compose-form__field">
                  <span className="forum-compose-form__label">
                    {isStoryTopic(form.topic) ? '故事標題' : '標題'}
                    {isStoryTopic(form.topic) && <span className="forum-compose-form__required">必填</span>}
                  </span>
                  <input
                    placeholder={isStoryTopic(form.topic) ? '為這本書取個名字…' : '標題（可選）'}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    maxLength={100}
                    className="pixel-input"
                    required={isStoryTopic(form.topic)}
                  />
                </label>
                {isStoryTopic(form.topic) && (
                  <ForumStoryComposeFields
                    coverUrl={form.cover_image_url}
                    synopsis={form.synopsis}
                    onCoverChange={(cover_image_url) => setForm((f) => ({ ...f, cover_image_url }))}
                    onSynopsisChange={(synopsis) => setForm((f) => ({ ...f, synopsis }))}
                    disabled={submitting}
                  />
                )}
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
                <fieldset className={`forum-visibility-field${isStoryTopic(form.topic) ? ' forum-visibility-field--story' : ''}`}>
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
                      <span>公開</span>
                    </label>
                    <label className={`forum-visibility-option${form.visibility === 'members_only' ? ' forum-visibility-option--active' : ''}`}>
                      <input
                        type="radio"
                        name="forum-visibility"
                        value="members_only"
                        checked={form.visibility === 'members_only'}
                        onChange={() => setForm((f) => ({ ...f, visibility: 'members_only' }))}
                      />
                      <span><ForumLockIcon size={12} /> 會員限定</span>
                    </label>
                  </div>
                  {form.visibility === 'members_only' && (
                    <p className="forum-visibility-field__hint">會員限定貼文僅登入用戶可閱讀，未登入者不會在列表看到。</p>
                  )}
                </fieldset>
                )}
                {!isStoryTopic(form.topic) && (
                  <label className={`forum-anonymous-field${form.hide_username ? ' forum-anonymous-field--active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!form.hide_username}
                      onChange={(e) => setForm((f) => ({ ...f, hide_username: e.target.checked }))}
                      disabled={submitting}
                    />
                    <span className="forum-anonymous-field__copy">
                      <span className="forum-anonymous-field__title">匿名發文</span>
                      <span className="forum-anonymous-field__hint">隱藏你的用戶名，對外顯示為「神秘貓咪」。留言仍會顯示你的用戶名。</span>
                    </span>
                  </label>
                )}
                {isStoryTopic(form.topic) && (
                  <label className="forum-compose-form__field">
                    <span className="forum-compose-form__label">第一章標題（可選）</span>
                    <input
                      placeholder="例：第一章 · 白映初的出走"
                      value={form.chapter_one_title}
                      onChange={(e) => setForm((f) => ({ ...f, chapter_one_title: e.target.value }))}
                      maxLength={STORY_CHAPTER_TITLE_MAX}
                      className="pixel-input"
                      disabled={submitting}
                    />
                  </label>
                )}
                <ForumComposeField
                  value={form.content}
                  onChange={(content) => setForm((f) => ({ ...f, content }))}
                  polls={form.polls}
                  onPollsChange={(polls) => setForm((f) => ({ ...f, polls }))}
                  accessToken={session?.access_token}
                  maxLength={isStoryTopic(form.topic) ? STORY_CONTENT_MAX : 2000}
                  minRows={isStoryTopic(form.topic) ? 12 : 5}
                  placeholder={isStoryTopic(form.topic)
                    ? '正文內容…（10–20000 字，支援較長篇幅）'
                    : '說說你想說的…（10–2000 字）'}
                  required
                  disabled={submitting}
                  className={isStoryTopic(form.topic) ? 'forum-compose-field--story' : ''}
                  label={isStoryTopic(form.topic) ? '正文' : '內容'}
                />
                {submitError && <p className="pixel-error">{submitError}</p>}
                <div className={`forum-compose-actions${isStoryTopic(form.topic) ? ' forum-compose-actions--story' : ''}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeCompose();
                    }}
                    className="forum-compose-actions__cancel"
                  >
                    取消並捨棄
                  </button>
                  <button type="submit" disabled={submitting} className="forum-compose-actions__submit">
                    {submitting ? '發送中…' : (isStoryTopic(form.topic) ? '放上書架' : '發文')}
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
              {bookmarkToast === 'saved' ? <HeaderBookmarkIcon size={14} /> : '✦'}
            </span>
            {bookmarkToast === 'saved' ? '已收入書櫃' : '已從書櫃取下'}
          </p>
        </div>
      )}
    </>
  );
}
