/**
 * /inbox/[threadId] — Mystic thread detail + async reply
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
import PixelMixedLabel from '../../components/PixelMixedLabel.js';
import { markInboxThreadReadLocally } from '../../lib/inbox-read-sync.js';

function isLetterMessage(msg) {
  if (isSystemMessage(msg)) return false;
  const type = msg?.message_type;
  return type === 'user_letter' || type === 'letter' || !type;
}

function isSystemMessage(msg) {
  if (msg?.message_type === 'system') return true;
  const kind = msg?.payload?.kind;
  return typeof kind === 'string' && kind.startsWith('gathering_');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function clampMatchScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getMatchRarity(score) {
  const s = clampMatchScore(score);
  if (s >= 91) return { label: 'SSR', tier: 'ssr' };
  if (s >= 81) return { label: 'SR', tier: 'sr' };
  if (s >= 75) return { label: 'R', tier: 'r' };
  return null;
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
    const userId = session?.user?.id;
    try {
      const r = await fetch(`/api/inbox/threads/${encodeURIComponent(threadId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Load failed'); }
      const d = await r.json();
      setData(d);
      setFetchError(null);
      if (userId) {
        markInboxThreadReadLocally(userId, threadId, {
          fallbackUnread: Number(d.marked_read_count) || 0,
        });
      }
    } catch (e) {
      setFetchError(e.message);
    }
  }, [threadId, session?.user?.id]);

  useLayoutEffect(() => {
    if (!session?.user?.id || !threadId || typeof threadId !== 'string') return;
    markInboxThreadReadLocally(session.user.id, threadId);
  }, [session?.user?.id, threadId]);

  useEffect(() => {
    if (!session?.user?.id || !threadId) return;
    loadThread();
  }, [session?.user?.id, threadId, loadThread]);

  useEffect(() => {
    if (!data) return;
    // A match-card-only thread has no conversation to follow — anchor to the top
    // so the card header is visible, instead of scrolling to the latest message.
    const isMatchOnly = data?.thread?.source_type === 'match'
      && !(data.messages || []).some(
        (m) => isLetterMessage(m) || m.message_type === 'photo_exchange_request',
      );
    if (isMatchOnly) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
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
          backHref="/inbox"
          backLabel="返回"
          headerVariant="account"
          pageClassName="app-page--inbox"
          maxWidth="520px"
        >
          <MoonLoading variant="hero" />
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
          backHref="/inbox"
          backLabel="返回"
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
  const isSystemThread = data?.thread?.source_type === 'system';
  const letterMessages = isPhotoExchangeThread
    ? []
    : messages.filter((m) => isLetterMessage(m));
  const systemMessages = isPhotoExchangeThread
    ? []
    : messages.filter((m) => isSystemMessage(m));
  // 一個 thread 只代表一次連線；match_card 可能重複入庫，只保留第一張。
  const matchMessages = isPhotoExchangeThread
    ? []
    : messages
        .filter((m) => m.message_type === 'match_card')
        .slice(0, 1);
  const exchangeRequests = isPhotoExchangeThread
    ? messages.filter((m) => m.message_type === 'photo_exchange_request')
    : [];
  const other = data?.other_participant;
  const pageTitle = isPhotoExchangeThread
    ? `與 ${other?.display_name || '對方'} 交換相`
    : isSystemThread
      ? (other?.display_name || '系統通知')
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

  const isMatchOnlyThread = data?.thread?.source_type === 'match'
    && letterMessages.length === 0
    && exchangeRequests.length === 0;

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
        backHref="/inbox"
        backLabel="返回"
        headerVariant="account"
        pageClassName={`app-page--inbox app-page--thread${isPhotoExchangeThread ? ' app-page--photo-exchange-thread' : ''}${isMatchOnlyThread ? ' app-page--match-thread' : ''}${isSystemThread ? ' app-page--system-thread' : ''}`}
        nav={<AppHeaderAuth redirectPath={router.asPath || '/inbox'} />}
      >
        {data?.status_banner && !isSystemThread && (
          <div className="channel-status-banner" role="status">
            <span className="channel-status-banner__icon" aria-hidden="true">⏳</span>
            <ScrollMixedText text={data.status_banner} />
          </div>
        )}

        <div className={`thread-messages thread-messages--moon${isPhotoExchangeThread ? ' thread-messages--photo-exchange' : ''}${isMatchOnlyThread ? ' thread-messages--match-only' : ''}${isSystemThread ? ' thread-messages--system' : ''}`}>
          {!data ? (
            <MoonLoading className="letter-thread letter-thread--centered" />
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
                {letterMessages.length === 0 && matchMessages.length === 0 && systemMessages.length === 0 && exchangeRequests.length === 0 && !composeMode && (
                  <p className="pixel-muted letter-thread letter-thread--centered letter-thread--empty">
                    暫時沒有訊息。
                  </p>
                )}
                {systemMessages.map((msg, index) => (
                  <SystemNoticeItem key={msg.id} msg={msg} stackIndex={index} />
                ))}
                {matchMessages.map((msg, index) => (
                  <MessageItem
                    key={msg.id}
                    msg={msg}
                    isMine={msg.is_mine}
                    otherName={other?.display_name}
                    mirrorCardHref={mirrorCardHref}
                    stackIndex={systemMessages.length + index}
                  />
                ))}
                {letterMessages.map((msg, index) => (
                  <MessageItem
                    key={msg.id}
                    msg={msg}
                    isMine={msg.is_mine}
                    otherName={other?.display_name}
                    stackIndex={systemMessages.length + matchMessages.length + index}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
                </>
              )}
            </div>
          )}
        </div>

        {composeMode === 'reply' && !isPhotoExchangeThread && !isSystemThread && (
          <div className="thread-compose-dock">
            {renderComposeForm(letterMessages.length + matchMessages.length)}
          </div>
        )}

        {showMidnightBar && !isPhotoExchangeThread && !isSystemThread && (
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

function SystemNoticeItem({ msg, stackIndex = 0 }) {
  const url = typeof msg.payload?.gathering_url === 'string'
    ? msg.payload.gathering_url
    : (typeof msg.payload?.forum_url === 'string' ? msg.payload.forum_url : null);
  const cta = msg.payload?.kind === 'gathering_application' || msg.payload?.kind === 'gathering_joined'
    ? '查看申請 →'
    : msg.payload?.kind === 'gathering_approved'
      || msg.payload?.kind === 'gathering_rejected'
      || msg.payload?.kind === 'gathering_applied'
      ? '查看聚會 →'
      : url
        ? '查看詳情 →'
        : null;

  return (
    <div
      className="letter-row letter-row--center inbox-system-notice-row"
      style={{ '--letter-z': stackIndex + 1 }}
    >
      <article className="inbox-system-notice">
        <p className="inbox-system-notice__eyebrow">
          {typeof msg.payload?.kind === 'string' && msg.payload.kind.startsWith('gathering_')
            ? '月光聚會'
            : '系統通知'}
        </p>
        <p className="inbox-system-notice__body">{msg.content}</p>
        {url && cta && (
          <Link href={url} className="inbox-system-notice__link pixel-link">
            {cta}
          </Link>
        )}
        <time className="inbox-system-notice__time" dateTime={msg.created_at}>
          {formatTime(msg.created_at)}
        </time>
      </article>
    </div>
  );
}

function MessageItem({ msg, isMine, otherName, mirrorCardHref, stackIndex = 0 }) {
  const isMatchCard = msg.message_type === 'match_card';
  const timestamp = formatTime(msg.created_at);
  const senderName = isMine
    ? '我'
    : (msg.sender?.display_name || otherName || '對方');
  const senderIsPremium = !isMine && Boolean(msg.sender?.is_premium);
  const rowSide = isMatchCard ? 'center' : (isMine ? 'mine' : 'theirs');
  const matchScore = msg.payload?.match_score;
  const scoreNum = matchScore != null ? clampMatchScore(matchScore) : null;
  const rarity = scoreNum != null ? getMatchRarity(scoreNum) : null;

  if (isMatchCard) {
    return (
      <div
        className="letter-row letter-row--center inbox-match-card-row"
        style={{ '--letter-z': stackIndex + 1, '--letter-tilt': '0deg' }}
      >
        <article
          className={`inbox-match-card inbox-match-card--game msg-match-card${rarity ? ` inbox-match-card--${rarity.tier}` : ''}`}
        >
          <div className="inbox-match-card__grid" aria-hidden="true" />
          <div className="inbox-match-card__glow" aria-hidden="true" />
          {rarity?.tier === 'ssr' && <div className="inbox-match-card__shine" aria-hidden="true" />}
          <span className="inbox-match-card__corner inbox-match-card__corner--tl" aria-hidden="true" />
          <span className="inbox-match-card__corner inbox-match-card__corner--tr" aria-hidden="true" />
          <span className="inbox-match-card__corner inbox-match-card__corner--bl" aria-hidden="true" />
          <span className="inbox-match-card__corner inbox-match-card__corner--br" aria-hidden="true" />

          <header className="inbox-match-card__header">
            <div className="inbox-match-card__quest-bar">
              <div className="inbox-match-card__header-copy">
                <p className="inbox-match-card__header-eyebrow">靈魂共鳴</p>
                <h2 className="inbox-match-card__title">連線成功</h2>
              </div>
              {rarity && (
                <span className={`inbox-match-card__rarity inbox-match-card__rarity--${rarity.tier}`}>
                  {rarity.label}
                </span>
              )}
            </div>
          </header>

          {otherName && (
            <div className="inbox-match-card__target">
              <span className="inbox-match-card__target-label">TARGET</span>
              <p className="inbox-match-card__partner">
                <PixelMixedLabel
                  text={otherName}
                  zhClass="inbox-match-card__partner-zh"
                  enClass="inbox-match-card__partner-en"
                />
              </p>
            </div>
          )}

          {scoreNum != null && (
            <div
              className="inbox-match-card__stats"
              style={{ '--sync-pct': scoreNum }}
              aria-label={`同步率 ${scoreNum} 分`}
            >
              <div className="inbox-match-card__stat-hdr">
                <span className="inbox-match-card__stat-label">SYNC RATE</span>
                <span className="inbox-match-card__stat-zh">同步率</span>
              </div>
              <div
                className="inbox-match-card__sync-bar"
                role="meter"
                aria-valuenow={scoreNum}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="inbox-match-card__sync-fill" />
                <span className="inbox-match-card__sync-score">{scoreNum}</span>
              </div>
              <span className="inbox-match-card__score-max">/ 100</span>
            </div>
          )}

          <div className="inbox-match-card__hint">
            <span className="inbox-match-card__hint-icon" aria-hidden="true">🌙</span>
            <p className="inbox-match-card__hint-text">
              {mirrorCardHref
                ? '連線通知已寄至你的電郵信箱；亦可點擊下方查看對方鏡像卡。'
                : '連線通知已寄至你的電郵信箱，請前往查收。'}
            </p>
          </div>
          {mirrorCardHref ? (
            <Link href={mirrorCardHref} className="inbox-match-card__cta pixel-btn pixel-btn--primary">
              ▶ 查看 Mirror Card
            </Link>
          ) : (
            <p className="inbox-match-card__footnote">
              <span className="inbox-match-card__footnote-icon" aria-hidden="true">✉</span>
              對方尚未註冊網站帳號，可先透過 Email 配對卡聯繫
            </p>
          )}
          <footer className="inbox-match-card__footer">
            <span className="inbox-match-card__footer-label">收到時間</span>
            <time className="inbox-match-card__time" dateTime={msg.created_at || undefined}>{timestamp}</time>
          </footer>
        </article>
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
