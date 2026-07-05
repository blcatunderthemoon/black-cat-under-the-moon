/**
 * /inbox — Thread list page
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context.js';
import { useClientReady } from '../lib/use-client-ready.js';
import { isPremiumUser } from '../lib/premium.js';
import { readStoredAuthSession } from '../lib/browser-session.js';
import { readInboxThreadsCache, writeInboxThreadsCache, clearInboxThreadsCache } from '../lib/inbox-threads-cache.js';
import { readMeCache } from '../lib/me-cache.js';
import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import InboxUserSearch from '../components/InboxUserSearch.js';
import PixelMoonIcon from '../components/PixelMoonIcon.js';
import PixelSealedLetterIcon from '../components/PixelSealedLetterIcon.js';
import PixelPhotoExchangeIcon from '../components/PixelPhotoExchangeIcon.js';
import InboxClosedChannelHint, { InboxListMetaText } from '../components/InboxListMeta.js';
import PixelMixedLabel from '../components/PixelMixedLabel.js';
import { LIST_META_MIRROR_CLOSED } from '../lib/inbox-channel.js';
import MoonLoading from '../components/MoonLoading.js';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return '剛才';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 日前`;
}

export default function InboxPage() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const clientReady = useClientReady();
  const didRedirect = useRef(false);
  const lastFetchedTokenRef = useRef(null);
  const [threads, setThreads] = useState(null);
  const [threadsLoading, setThreadsLoading] = useState(true);

  const authTokenRef = useRef(null);
  if (session?.access_token) authTokenRef.current = session.access_token;

  const loadThreads = useCallback(async (token, userId, { silent = false } = {}) => {
    if (!token) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }

    const cached = userId ? readInboxThreadsCache(userId) : null;

    if (!silent) {
      if (cached) {
        setThreads(cached);
        setThreadsLoading(false);
      } else {
        setThreadsLoading(true);
      }
      if (lastFetchedTokenRef.current === token) return;
      lastFetchedTokenRef.current = token;
    }

    authTokenRef.current = token;

    try {
      const r = await fetch('/api/inbox/threads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = r.ok ? await r.json() : { threads: [] };
      const next = data.threads || [];
      setThreads(next);
      if (userId) writeInboxThreadsCache(userId, next);
    } catch {
      if (!silent) lastFetchedTokenRef.current = null;
      if (!cached && !silent) setThreads([]);
    } finally {
      if (!silent) setThreadsLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (!clientReady) return;
    const stored = readStoredAuthSession();
    const token = session?.access_token ?? stored?.access_token;
    const userId = session?.user?.id ?? stored?.user?.id;
    if (!token || !userId) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }
    const cached = readInboxThreadsCache(userId);
    if (cached) {
      setThreads(cached);
      setThreadsLoading(false);
    }
  }, [clientReady, session?.access_token, session?.user?.id]);

  // Start fetch as soon as a stored token exists (overlaps auth resolution).
  useEffect(() => {
    const stored = readStoredAuthSession();
    if (stored?.access_token && stored?.user?.id) {
      loadThreads(stored.access_token, stored.user.id);
    }
  }, [loadThreads]);

  useEffect(() => {
    if (!clientReady || !router.isReady || loading || session) return;
    if (didRedirect.current) return;
    didRedirect.current = true;
    router.replace('/login?redirect=/inbox');
  }, [clientReady, router.isReady, session, loading, router]);

  useEffect(() => {
    if (!session?.user?.id || !session?.access_token) return;
    if (lastFetchedTokenRef.current !== session.access_token) {
      lastFetchedTokenRef.current = null;
    }
    loadThreads(session.access_token, session.user.id);
  }, [session?.user?.id, session?.access_token, loadThreads]);

  useEffect(() => {
    if (!session?.user?.id || !session?.access_token) return;

    const refreshThreads = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      lastFetchedTokenRef.current = null;
      loadThreads(session.access_token, session.user.id, { silent: true });
    };

    window.addEventListener('focus', refreshThreads);
    window.addEventListener('pageshow', refreshThreads);
    return () => {
      window.removeEventListener('focus', refreshThreads);
      window.removeEventListener('pageshow', refreshThreads);
    };
  }, [session?.user?.id, session?.access_token, loadThreads]);

  const storedAuth = clientReady ? readStoredAuthSession() : null;
  const hasStoredAuth = Boolean(storedAuth?.access_token);
  const showShell = clientReady && (session || hasStoredAuth);
  const userId = session?.user?.id ?? storedAuth?.user?.id;
  const meData = profile ?? (userId ? readMeCache(userId) : null);
  const isPremium = isPremiumUser(meData);
  const inboxReady = !threadsLoading && threads !== null;

  const handleInboxUpdated = useCallback(() => {
    lastFetchedTokenRef.current = null;
    clearInboxThreadsCache();
    if (session?.access_token && session?.user?.id) {
      loadThreads(session.access_token, session.user.id, { silent: true });
    }
  }, [session?.access_token, session?.user?.id, loadThreads]);

  const booting = !clientReady || (loading && !hasStoredAuth && !session);

  if (booting || !showShell) {
    return (
      <>
        <Head><title>收件箱 — Black Cat Under The Moon</title></Head>
        <AppShell
          title="收件箱"
          headerVariant="account"
          pageClassName="app-page--inbox app-page--inbox-loading"
          maxWidth="680px"
        >
          <MoonLoading label="載入收件箱…" variant="hero" className="inbox-page-loading" />
        </AppShell>
      </>
    );
  }

  if (!inboxReady) {
    return (
      <>
        <Head><title>收件箱 — Black Cat Under The Moon</title></Head>
        <AppShell
          title="收件箱"
          headerVariant="account"
          pageClassName="app-page--inbox app-page--inbox-loading"
          maxWidth="680px"
          nav={<AppHeaderAuth redirectPath="/inbox" />}
        >
          <MoonLoading label="載入收件箱…" variant="hero" className="inbox-page-loading" />
        </AppShell>
      </>
    );
  }

  return (
    <>
      <Head><title>收件箱 — Black Cat Under The Moon</title></Head>
      <AppShell
        title="收件箱"
        headerVariant="account"
        pageClassName="app-page--inbox"
        maxWidth="680px"
        nav={<AppHeaderAuth redirectPath="/inbox" />}
      >
        <div className="inbox-list-wrap">
          {isPremium && session?.access_token && (
            <InboxUserSearch
              accessToken={session.access_token}
              onSent={handleInboxUpdated}
            />
          )}
          {threads.length === 0 ? (
            <div className="pixel-empty inbox-empty">
              <PixelMoonIcon />
              <p className="inbox-empty__headline">收件箱暫時為空。</p>
              <p className="inbox-empty__hint">
                連線成功後，對方的卡片會出現在這裡。
              </p>
              <Link
                href="/forum"
                className="pixel-btn pixel-btn--primary account-action-btn inbox-empty__cta"
              >
                去黑貓樹洞認識新朋友
              </Link>
            </div>
          ) : (
            <ul className="inbox-letter-list">
              {threads.map((thread) => {
                const hasUnread = thread.unread_count > 0;
                const hasReplyOpportunity = thread.reply_opportunity;
                const isMatch = thread.source_type === 'match';
                const iconVariant = hasUnread ? 'sealed-glow' : 'read';
                const metaText = thread.list_meta
                  || (hasUnread && hasReplyOpportunity && !isMatch ? '1 封回信機會待用' : null);
                const isMirrorClosed = metaText === LIST_META_MIRROR_CLOSED;

                const isPhotoExchange = thread.source_type === 'photo_exchange';
                const isOpportunityMeta = metaText && /回信機會|尚餘.*次來回/.test(metaText);
                const isMatchHighlight = isMatch && (thread.match_highlight || hasUnread);

                return (
                  <li key={thread.id} className="inbox-letter-list__item">
                    <Link
                      href={`/inbox/${thread.id}`}
                      className={`inbox-letter-row${isMirrorClosed ? ' inbox-letter-row--closed' : ''}${isPhotoExchange ? ' inbox-letter-row--photo-exchange' : ''}${isMatchHighlight ? ' inbox-letter-row--match' : ''}${hasReplyOpportunity && hasUnread && !isMatch ? ' inbox-letter-row--opportunity' : ''}`}
                    >
                      {hasUnread && (
                        <span
                          className={`inbox-letter-row__new-badge${isMatch ? ' inbox-letter-row__new-badge--match' : ''}`}
                          aria-label={isMatch ? '新的連線通知' : '未讀的新訊息'}
                        >
                          {isMatch ? '連線' : 'NEW'}
                        </span>
                      )}
                      {isPhotoExchange ? (
                        <PixelPhotoExchangeIcon variant={iconVariant} size={66} />
                      ) : (
                        <PixelSealedLetterIcon variant={iconVariant} size={66} />
                      )}
                      <div className="inbox-letter-row__stack">
                        <div className="inbox-letter-row__line">
                          <div className="inbox-letter-row__body">
                            <span className="inbox-letter-row__name">
                              <PixelMixedLabel
                                text={thread.other_participant.display_name}
                                zhClass="inbox-letter-row__zh"
                                enClass="inbox-letter-row__en inbox-letter-row__en--name"
                              />
                            </span>
                            <span className="inbox-letter-row__title">
                              {thread.mysterious_title || (isMatch ? '靈魂共鳴連線通知' : '來自夜色的低語…')}
                            </span>
                          </div>
                          {!isMirrorClosed && (
                            <div className="inbox-letter-row__meta">
                              {metaText ? (
                                <InboxListMetaText text={metaText} badge={isOpportunityMeta} />
                              ) : (
                                <span className="inbox-letter-row__time">
                                  {timeAgo(thread.last_message_at)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {isMirrorClosed && <InboxClosedChannelHint />}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AppShell>
    </>
  );
}
