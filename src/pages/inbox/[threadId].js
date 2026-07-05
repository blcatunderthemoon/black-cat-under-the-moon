/**
 * /inbox/[threadId] — Mystic thread detail + async reply
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context.js';
import { useClientReady } from '../../lib/use-client-ready.js';
import AppShell, { AppHeaderMixedText } from '../../components/AppShell.js';
import AppHeaderAuth from '../../components/AppHeaderAuth.js';
import PixelScrollMessage, { ScrollMixedText } from '../../components/PixelScrollMessage.js';
import LetterComposeForm from '../../components/LetterComposeForm.js';
import PremiumMoonBadge from '../../components/PremiumMoonBadge.js';
import { INBOX_MESSAGE_MAX_LENGTH } from '../../lib/inbox-limits.js';
import {
  COMPOSE_PLACEHOLDER,
  COMPOSE_TITLE_REPLY,
  CHANNEL_MAX_ROUND_TRIPS,
} from '../../lib/inbox-channel.js';
import { DEFAULT_LETTER_PREFS } from '../../lib/letter-gameplay.js';
import MoonLoading from '../../components/MoonLoading.js';
import PhotoExchangeInboxPanel from '../../components/PhotoExchangeInboxPanel.js';
import ChannelStatusLine from '../../components/ChannelStatusLine.js';

function isLetterMessage(msg) {
  const type = msg?.message_type;
  return type === 'user_letter' || type === 'letter' || !type;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ThreadPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { threadId } = router.query;
  const clientReady = useClientReady();
  const didRedirect = useRef(false);
  const authTokenRef = useRef(null);
  if (session?.access_token) authTokenRef.current = session.access_token;

  const [data, setData] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [letterPrefs, setLetterPrefs] = useState(DEFAULT_LETTER_PREFS);
  const prefsSaveRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!clientReady || !router.isReady || loading || session) return;
    if (didRedirect.current) return;
    didRedirect.current = true;
    const redirect = router.asPath || '/inbox';
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [clientReady, router.isReady, router.asPath, session, loading, router]);

  const loadThread = useCallback(async () => {
    const token = authTokenRef.current;
    if (!token || !threadId || typeof threadId !== 'string') return;
    try {
      const r = await fetch(`/api/inbox/threads/${encodeURIComponent(threadId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Load failed'); }
      const d = await r.json();
      setData(d);
      setFetchError(null);
    } catch (e) {
      setFetchError(e.message);
    }
  }, [threadId]);

  useEffect(() => {
    if (!session?.user?.id || !threadId) return;
    loadThread();
  }, [session?.user?.id, threadId, loadThread]);

  useEffect(() => {
    if (!data) return;
    if (!data.messages?.length && !data.compose_mode) return;
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [data?.messages?.length, data?.compose_mode, data]);

  useEffect(() => {
    if (data?.viewer_letter_prefs) {
      setLetterPrefs(data.viewer_letter_prefs);
    }
  }, [data?.viewer_letter_prefs]);

  const saveLetterPrefs = useCallback((nextPrefs) => {
    setLetterPrefs(nextPrefs);
    if (prefsSaveRef.current) window.clearTimeout(prefsSaveRef.current);
    prefsSaveRef.current = window.setTimeout(async () => {
      const token = authTokenRef.current;
      if (!token) return;
      try {
        await fetch('/api/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            letter_prefs: {
              stamp_id: nextPrefs.stamp_id,
              note_color: nextPrefs.note_color,
              note_font: nextPrefs.note_font,
              sound_enabled: nextPrefs.sound_enabled,
            },
          }),
        });
      } catch {
        /* prefs are non-critical */
      }
    }, 400);
  }, []);

  async function handleSend(e, letterStyle) {
    e?.preventDefault?.();
    if (!reply.trim() || sending || !data?.can_compose) return;
    setSending(true);
    setSendError('');

    try {
      const r = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipient_id: data?.other_participant?.id,
          content: reply.trim(),
          thread_id: threadId,
          letter_style: letterStyle || null,
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        setSendError(result.error || '發送失敗，請稍後再試。');
        return;
      }
      setReply('');
      await loadThread();
    } catch {
      setSendError('發送失敗，請稍後再試。');
    } finally {
      setSending(false);
    }
  }

  const booting = !clientReady || loading;
  const showShell = clientReady && !loading && session;

  if (booting || !showShell) {
    return (
      <>
        <Head><title>對話 — Black Cat Under The Moon</title></Head>
        <AppShell
          title="對話"
          backHref="/index.html"
          headerVariant="account"
          pageClassName="app-page--inbox"
          maxWidth="520px"
        >
          <MoonLoading label="載入中…" />
        </AppShell>
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <Head><title>對話 — Black Cat Under The Moon</title></Head>
        <AppShell
          title="對話"
          backHref="/index.html"
          headerVariant="account"
          pageClassName="app-page--inbox"
          maxWidth="520px"
        >
          <section className="pixel-card pixel-card--moon inbox-panel">
            <div className="pixel-empty inbox-empty">
              <p className="inbox-empty__headline">{fetchError}</p>
              <Link href="/inbox" className="pixel-link">← 返回收件箱</Link>
            </div>
          </section>
        </AppShell>
      </>
    );
  }

  const messages = data?.messages || [];
  const isPhotoExchangeThread = data?.thread?.source_type === 'photo_exchange';
  const letterMessages = isPhotoExchangeThread
    ? []
    : messages.filter((m) => isLetterMessage(m));
  const matchMessages = isPhotoExchangeThread
    ? []
    : messages.filter((m) => m.message_type === 'match_card');
  const exchangeRequests = isPhotoExchangeThread
    ? messages.filter((m) => m.message_type === 'photo_exchange_request')
    : [];
  const other = data?.other_participant;
  const pageTitle = isPhotoExchangeThread
    ? `與 ${other?.display_name || '對方'} 交換相`
    : (other?.display_name || '對話');
  const mirrorCardHref = other?.mirror_card_slug
    ? `/mirror-card/${encodeURIComponent(other.mirror_card_slug)}`
    : null;
  const composeMode = data?.compose_mode === 'reply' ? 'reply' : null;
  const composePlaceholder = COMPOSE_PLACEHOLDER;
  const composeTitle = composeMode === 'reply'
    ? (data?.compose_title || COMPOSE_TITLE_REPLY)
    : null;
  const showMidnightBar = Boolean(data?.status_footer);

  function renderComposeForm(messageCount = 0) {
    if (composeMode !== 'reply') return null;
    return (
      <div
        className="letter-row letter-row--mine letter-row--compose-slot"
        style={{ '--letter-z': messageCount + 1 }}
      >
        <LetterComposeForm
          mode={composeMode}
          title={composeTitle}
          hint={data.compose_hint}
          placeholder={composePlaceholder}
          value={reply}
          onChange={setReply}
          onSubmit={handleSend}
          sending={sending}
          error={sendError}
          maxLength={INBOX_MESSAGE_MAX_LENGTH}
          channelRemaining={data?.channel_round_trips_remaining}
          channelMax={CHANNEL_MAX_ROUND_TRIPS}
          letterPrefs={letterPrefs}
          onLetterPrefsChange={saveLetterPrefs}
          showGameplay
          viewerTier={data?.viewer_tier || 'premium'}
          compact
        />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {other ? `與 ${other.display_name} 的對話` : '對話'} — Black Cat Under The Moon
        </title>
      </Head>
      <AppShell
        thread
        title={
          mirrorCardHref ? (
            <Link href={mirrorCardHref} className="inbox-thread-title-link" title="查看 Mirror Card">
              <AppHeaderMixedText
                text={pageTitle}
                zhClass="app-header__text-zh app-header__text-zh--title"
                enClass="app-header__text-en app-header__text-en--title"
              />
              {other?.is_premium && <PremiumMoonBadge className="inbox-thread-title-moon" />}
            </Link>
          ) : (
            <>
              <AppHeaderMixedText
                text={pageTitle}
                zhClass="app-header__text-zh app-header__text-zh--title"
                enClass="app-header__text-en app-header__text-en--title"
              />
              {other?.is_premium && <PremiumMoonBadge className="inbox-thread-title-moon" />}
            </>
          )
        }
        backHref="/index.html"
        headerVariant="account"
        pageClassName={`app-page--inbox app-page--thread${isPhotoExchangeThread ? ' app-page--photo-exchange-thread' : ''}`}
        nav={<AppHeaderAuth redirectPath={router.asPath || '/inbox'} />}
      >
        {data?.status_banner && (
          <div className="channel-status-banner" role="status">
            <span className="channel-status-banner__icon" aria-hidden="true">⏳</span>
            <ScrollMixedText text={data.status_banner} />
          </div>
        )}

        {data?.thread?.source_type === 'match' && (
          <p className="inbox-thread-source-tag">🎯 連線</p>
        )}

        <div className={`thread-messages thread-messages--moon${isPhotoExchangeThread ? ' thread-messages--photo-exchange' : ''}`}>
          {!data ? (
            <MoonLoading label="載入中…" className="letter-thread letter-thread--centered" />
          ) : (
            <div className="letter-thread">
              {isPhotoExchangeThread ? (
                <div className="inbox-exchange-requests inbox-exchange-requests--thread-only">
                  {exchangeRequests.length === 0 ? (
                    <p className="pixel-muted letter-thread letter-thread--centered letter-thread--empty">
                      暫時沒有交換相請求。
                    </p>
                  ) : (
                    <div className="inbox-exchange-requests__list">
                      {exchangeRequests.map((msg) => {
                        const exchangeId = msg.payload?.exchange_id;
                        const initialDetail = exchangeId
                          ? data?.photo_exchange_by_id?.[String(exchangeId)]
                          : null;
                        return (
                        <PhotoExchangeInboxPanel
                          key={msg.id}
                          exchangeId={exchangeId}
                          accessToken={session?.access_token}
                          initialDetail={initialDetail}
                          initialViewerName={data?.viewer_name}
                          initialViewerPhotoUrl={data?.viewer_exchange_photo_url}
                          onComplete={loadThread}
                        />
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
              <div className="thread-messages__inner thread-messages__inner--scroll thread-messages__inner--desk">
                {letterMessages.length === 0 && matchMessages.length === 0 && exchangeRequests.length === 0 && !composeMode && (
                  <p className="pixel-muted letter-thread letter-thread--centered letter-thread--empty">
                    暫時沒有訊息。
                  </p>
                )}
                {matchMessages.map((msg, index) => (
                  <MessageItem
                    key={msg.id}
                    msg={msg}
                    isMine={msg.is_mine}
                    otherName={other?.display_name}
                    stackIndex={index}
                  />
                ))}
                {letterMessages.map((msg, index) => (
                  <MessageItem
                    key={msg.id}
                    msg={msg}
                    isMine={msg.is_mine}
                    otherName={other?.display_name}
                    stackIndex={matchMessages.length + index}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
                </>
              )}
            </div>
          )}
        </div>

        {composeMode === 'reply' && !isPhotoExchangeThread && (
          <div className="thread-compose-dock">
            {renderComposeForm(letterMessages.length + matchMessages.length)}
          </div>
        )}

        {showMidnightBar && !isPhotoExchangeThread && (
          <div className="channel-status-footer channel-status-footer--midnight" role="status">
            <ChannelStatusLine
              text={data.status_footer}
              channelOpen={false}
              align="center"
            />
            {mirrorCardHref && data.channel_state === 'closed' && data.viewer_tier === 'premium' && (
              <Link href={mirrorCardHref} className="channel-status-footer__mirror-link pixel-link">
                前往對方 Mirror Card →
              </Link>
            )}
          </div>
        )}
      </AppShell>
    </>
  );
}

/** Deterministic sticky-note tilt (−2° … +2°) from message id */
function stickyNoteTilt(seed) {
  let h = 0;
  const s = String(seed ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return ((Math.abs(h) % 41) - 20) / 10;
}

function MessageItem({ msg, isMine, otherName, stackIndex = 0 }) {
  const isMatchCard = msg.message_type === 'match_card';
  const timestamp = formatTime(msg.created_at);
  const senderName = isMine
    ? '我'
    : (msg.sender?.display_name || otherName || '對方');
  const senderIsPremium = !isMine && Boolean(msg.sender?.is_premium);
  const rowSide = isMatchCard ? 'center' : (isMine ? 'mine' : 'theirs');

  if (isMatchCard) {
    return (
      <div
        className={`letter-row letter-row--${rowSide}`}
        style={{ '--letter-z': stackIndex + 1, '--letter-tilt': '0deg' }}
      >
        <div className="msg-match-card letter-row__match-card">
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>🎯 連線成功</p>
          {msg.payload?.match_score != null && (
            <p style={{ fontSize: 13, margin: 0 }}>
              同步率：<strong>{msg.payload.match_score}/100</strong>
            </p>
          )}
          {msg.payload?.match_summary && Object.keys(msg.payload.match_summary).length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(msg.payload.match_summary).slice(0, 4).map(([k, v]) => (
                <li key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>{k}</span>
                  <span>{String(v)}</span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>查看對方 Mirror Card 了解更多</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`letter-row letter-row--${rowSide}`}
      style={{
        '--letter-z': stackIndex + 1,
        '--letter-tilt': `${stickyNoteTilt(msg.id)}deg`,
      }}
    >
      <PixelScrollMessage
        content={msg.content}
        isMine={isMine}
        senderName={senderName}
        senderIsPremium={senderIsPremium}
        timestamp={timestamp}
        message={msg}
      />
    </div>
  );
}
