/**
 * /mirror-card/[slug] — Public mirror card view
 */

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context.js';
import MirrorPersonalityCard from '../../components/MirrorPersonalityCard.js';
import PixelMixedLabel from '../../components/PixelMixedLabel.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../../lib/premium.js';
import LetterComposeForm from '../../components/LetterComposeForm.js';
import AppShell, { AppHeaderMixedText } from '../../components/AppShell.js';
import AppHeaderAuth from '../../components/AppHeaderAuth.js';
import SeoHead from '../../components/SeoHead.js';
import { INBOX_MESSAGE_MAX_LENGTH } from '../../lib/inbox-limits.js';
import {
  COMPOSE_PLACEHOLDER,
  COMPOSE_PLACEHOLDER_OPEN,
  COMPOSE_TITLE_OPEN,
} from '../../lib/inbox-channel.js';
import { getMirrorCardPageTitle, PERSONALITY_TYPES, CAT_IMG_MAP } from '../../lib/mirror-personality.js';
import { DEFAULT_LETTER_PREFS } from '../../lib/letter-gameplay.js';
import PageLoadingShell from '../../components/PageLoadingShell.js';
import { readMirrorCardSlugCache, writeMirrorCardSlugCache } from '../../lib/mirror-card-cache.js';
import PhotoExchangePanel from '../../components/PhotoExchangePanel.js';
import PhotoExchangeOverlay from '../../components/PhotoExchangeOverlay.js';
import MirrorVisitorPremiumUpsell, { buildMirrorVisitorPremiumPerks } from '../../components/MirrorVisitorPremiumUpsell.js';
import MirrorVisitorDualActions from '../../components/MirrorVisitorDualActions.js';
import MediaCaptureGuard from '../../components/MediaCaptureGuard.js';
import {
  ForumSparkleIcon,
  HeaderMailIcon,
  UiFlagIcon,
} from '../../components/UiIcons.js';
import { captureProductEvent, MATCH_WHISPER_EVENTS } from '../../lib/product-analytics.js';

function MirrorOwnerBioSection({ bio, displayName, variant = 'default' }) {
  const text = String(bio || '').trim();
  if (!text) return null;
  const name = String(displayName || '').trim();
  const isVisitor = variant === 'visitor';

  return (
    <section
      className={`mirror-card-bio${isVisitor ? ' mirror-card-bio--visitor' : ''}`}
      aria-label="自我介紹"
    >
      <div className="mirror-card-bio__glow" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--tl" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--tr" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--bl" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--br" aria-hidden="true" />

      <header className="mirror-card-bio__head">
        <span className="mirror-card-bio__icon" aria-hidden="true">
          <ForumSparkleIcon size={14} />
        </span>
        <div className="mirror-card-bio__head-text">
          <p className="mirror-card-bio__eyebrow">
            <span className="mirror-card-bio__eyebrow-prefix" aria-hidden="true">//</span>
            <span className="mirror-card-bio__eyebrow-label">自我介紹</span>
            <span className="mirror-card-bio__eyebrow-line" aria-hidden="true" />
          </p>
          {isVisitor && name ? (
            <h2 className="mirror-card-bio__title">
              <PixelMixedLabel
                text={`關於 ${name}`}
                zhClass="mirror-card-bio__title-zh"
                enClass="mirror-card-bio__title-en"
              />
            </h2>
          ) : (
            <h2 className="mirror-card-bio__title">自我介紹</h2>
          )}
        </div>
      </header>

      <blockquote className="mirror-card-bio__body">
        <p className="mirror-card-bio__text">{text}</p>
      </blockquote>
    </section>
  );
}

function MirrorReportConfirmOverlay({ open, onConfirm, onCancel, confirming }) {
  if (!open) return null;
  return (
    <div className="mirror-report-overlay show" role="dialog" aria-modal="true" aria-labelledby="mirror-report-confirm-title">
      <div className="mirror-report-overlay__box">
        <span className="mirror-report-overlay__icon" aria-hidden="true">
          <UiFlagIcon size={28} />
        </span>
        <div className="mirror-report-overlay__title" id="mirror-report-confirm-title">確認檢舉此用戶？</div>
        <div className="mirror-report-overlay__sub">
          我們會審核這份報告。請只在對方行為或內容確實違反社群規範時才提交檢舉。
        </div>
        <button type="button" className="mirror-report-overlay__confirm" onClick={onConfirm} disabled={confirming}>
          {confirming ? '提交中…' : '確認檢舉'}
        </button>
        <button type="button" className="mirror-report-overlay__cancel" onClick={onCancel} disabled={confirming}>
          取消
        </button>
      </div>
    </div>
  );
}

function MirrorLetterOverlay({
  open,
  ownerName,
  content,
  onContentChange,
  onSend,
  onCancel,
  sending,
  error,
  composeMode,
  composeTitle,
  composeHint,
  letterPrefs,
  onLetterPrefsChange,
  viewerTier = 'free',
}) {
  if (!open) return null;
  const mode = composeMode === 'reply' ? 'reply' : 'open';
  const title = composeTitle || COMPOSE_TITLE_OPEN;
  const placeholder = mode === 'open' ? COMPOSE_PLACEHOLDER_OPEN : COMPOSE_PLACEHOLDER;

  return (
    <div
      className="mirror-report-overlay show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mirror-letter-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onCancel?.();
      }}
    >
      <div className="mirror-report-overlay__box mirror-letter-overlay__box">
        <button
          type="button"
          className="mirror-overlay-close"
          onClick={onCancel}
          disabled={sending}
          aria-label="關閉"
        >
          ✕
        </button>
        <span className="mirror-report-overlay__icon" aria-hidden="true">
          <HeaderMailIcon size={28} />
        </span>
        <div className="mirror-report-overlay__title mirror-letter-overlay__title" id="mirror-letter-title">
          <PixelMixedLabel
            text={`留信給 ${ownerName || '對方'}`}
            zhClass="mirror-letter-overlay__text-zh mirror-letter-overlay__text-zh--title"
            enClass="mirror-letter-overlay__text-en mirror-letter-overlay__text-en--title"
          />
        </div>
        <div className="mirror-report-overlay__sub mirror-letter-overlay__sub">
          <PixelMixedLabel
            text="這是一封信，對方下次登入時才會收到。"
            zhClass="mirror-letter-overlay__text-zh mirror-letter-overlay__text-zh--sub"
            enClass="mirror-letter-overlay__text-en mirror-letter-overlay__text-en--sub"
          />
        </div>
        <div className="mirror-letter-overlay__form">
          <LetterComposeForm
            mode={mode}
            title={title}
            hint={composeHint}
            placeholder={placeholder}
            value={content}
            onChange={onContentChange}
            onSubmit={onSend}
            sending={sending}
            error={error}
            maxLength={INBOX_MESSAGE_MAX_LENGTH}
            letterPrefs={letterPrefs}
            onLetterPrefsChange={onLetterPrefsChange}
            showGameplay
            viewerTier={viewerTier}
            showCancel
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

export default function MirrorCardSlugPage({ seo = null }) {
  const router = useRouter();
  const { slug } = router.query;
  const { session } = useAuth();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [reportConfirmOpen, setReportConfirmOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState(null);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterSending, setLetterSending] = useState(false);
  const [letterError, setLetterError] = useState('');
  const [letterPrefs, setLetterPrefs] = useState(DEFAULT_LETTER_PREFS);
  const prefsSaveRef = useRef(null);
  const [letterNotice, setLetterNotice] = useState(null);
  const [photoExchangeOpen, setPhotoExchangeOpen] = useState(false);
  const [photoExchangeMode, setPhotoExchangeMode] = useState('request');
  const [photoExchangeInitialStep, setPhotoExchangeInitialStep] = useState('prepare');
  const [photoExchangeBusy, setPhotoExchangeBusy] = useState(false);
  const [photoExchangeError, setPhotoExchangeError] = useState('');
  const [photoExchangeNotice, setPhotoExchangeNotice] = useState(null);
  const [hasExchangePhoto, setHasExchangePhoto] = useState(false);
  const [exchangePhotoUrl, setExchangePhotoUrl] = useState('');
  const [photoExchangeDraftUrl, setPhotoExchangeDraftUrl] = useState(null);
  const [photoExchangeUploadKey, setPhotoExchangeUploadKey] = useState(0);
  const photoExchangeSnapshotRef = useRef({ hasPhoto: false, url: '' });

  async function reloadCard() {
    if (!slug) return;
    const headers = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    const r = await fetch(`/api/mirror-card/${encodeURIComponent(slug)}`, { headers });
    if (r.ok) {
      const refreshed = await r.json();
      setData(refreshed);
      writeMirrorCardSlugCache(slug, refreshed);
      const pe = refreshed.photo_exchange;
      if (pe?.is_owner) {
        setHasExchangePhoto(!!pe.has_exchange_photo);
        setExchangePhotoUrl(pe.exchange_photo_url || '');
      } else if (pe) {
        setHasExchangePhoto(!!pe.has_exchange_photo);
        setExchangePhotoUrl(pe.viewer_exchange_photo_url || '');
      }
    }
  }

  useEffect(() => {
    if (!slug) return undefined;
    const cached = readMirrorCardSlugCache(slug);
    const hasCache = Boolean(cached);
    if (hasCache) {
      setData(cached);
      setLoading(false);
      const pe = cached.photo_exchange;
      if (pe?.is_owner) {
        setHasExchangePhoto(!!pe.has_exchange_photo);
        setExchangePhotoUrl(pe.exchange_photo_url || '');
      } else if (pe) {
        setHasExchangePhoto(!!pe.has_exchange_photo);
        setExchangePhotoUrl(pe.viewer_exchange_photo_url || '');
      }
    } else {
      setLoading(true);
    }

    let cancelled = false;
    const headers = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    fetch(`/api/mirror-card/${encodeURIComponent(slug)}`, { headers })
      .then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Not found'); });
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        writeMirrorCardSlugCache(slug, d);
        const pe = d.photo_exchange;
        if (pe?.is_owner) {
          setHasExchangePhoto(!!pe.has_exchange_photo);
          setExchangePhotoUrl(pe.exchange_photo_url || '');
        } else if (pe) {
          setHasExchangePhoto(!!pe.has_exchange_photo);
          setExchangePhotoUrl(pe.viewer_exchange_photo_url || '');
        }
        setLoadError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        if (!hasCache) {
          setLoadError(e.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [slug, session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!r.ok || cancelled) return;
        const me = await r.json();
        if (me?.profile?.letter_prefs) {
          setLetterPrefs(me.profile.letter_prefs);
        }
      } catch {
        /* optional */
      }
    })();
    return () => { cancelled = true; };
  }, [session?.access_token]);

  function saveLetterPrefs(nextPrefs) {
    setLetterPrefs(nextPrefs);
    if (prefsSaveRef.current) window.clearTimeout(prefsSaveRef.current);
    if (!session?.access_token) return;
    prefsSaveRef.current = window.setTimeout(async () => {
      try {
        await fetch('/api/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
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
        /* non-critical */
      }
    }, 400);
  }

  useEffect(() => {
    if (!router.isReady || loading || !data || !session) return;
    const mode = router.query.exchange_confirm;
    if (mode !== 'request' && mode !== 'respond') return;

    setPhotoExchangeError('');
    setPhotoExchangeMode(mode);
    setPhotoExchangeInitialStep('confirm');
    const snap = snapshotPhotoExchangeState();
    photoExchangeSnapshotRef.current = snap;
    setPhotoExchangeDraftUrl(null);
    setHasExchangePhoto(snap.hasPhoto);
    setExchangePhotoUrl(snap.url);
    setPhotoExchangeUploadKey((k) => k + 1);
    setPhotoExchangeOpen(true);

    const nextQuery = { ...router.query };
    delete nextQuery.exchange_confirm;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }, [router.isReady, router.query.exchange_confirm, loading, data, session, router]);

  function openReportConfirm() {
    if (!session) {
      router.push(`/login?redirect=${encodeURIComponent(`/mirror-card/${slug || ''}`)}`);
      return;
    }
    setReportNotice(null);
    setReportConfirmOpen(true);
  }

  async function submitReport() {
    setReporting(true);
    try {
      const r = await fetch('/api/mirror-card/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ slug }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setReportNotice({ ok: false, text: err.error || '檢舉失敗，請稍後再試。' });
        return;
      }
      setReportConfirmOpen(false);
      setReportNotice({ ok: true, text: '已提交檢舉，感謝你的回報。' });
    } catch {
      setReportNotice({ ok: false, text: '網路錯誤，請重試。' });
    } finally {
      setReporting(false);
    }
  }

  function openLetterComposer() {
    if (!session) {
      router.push(`/login?redirect=${encodeURIComponent(`/mirror-card/${slug || ''}`)}`);
      return;
    }
    setLetterError('');
    setLetterNotice(null);
    setLetterOpen(true);
  }

  async function submitLetter(e, letterStyle) {
    e?.preventDefault?.();
    const messaging = data?.messaging;
    if (!messaging?.recipient_id || !messaging?.can_send || !letterContent.trim() || letterSending) return;

    setLetterSending(true);
    setLetterError('');
    try {
      const r = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipient_id: messaging.recipient_id,
          content: letterContent.trim(),
          thread_id: messaging.existing_thread_id || undefined,
          source_type: 'mirror_card',
          letter_style: letterStyle || null,
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        if (result.crisis) {
          setLetterError('訊息未能發送。如需協助，請聯絡專業人士。');
        } else {
          setLetterError(result.error || '發送失敗，請稍後再試。');
        }
        return;
      }
      setLetterOpen(false);
      setLetterContent('');
      setLetterNotice({ ok: true, threadId: result.thread_id });
      if (router.query?.from === 'match_whisper') {
        captureProductEvent(MATCH_WHISPER_EVENTS.convertToPassport, {
          intent: 'passport_letter_sent',
          thread_id: result.thread_id || null,
          mirror_slug: slug || null,
        });
      }
      await reloadCard();
    } catch {
      setLetterError('網路錯誤，請重試。');
    } finally {
      setLetterSending(false);
    }
  }

  function snapshotPhotoExchangeState() {
    const pe = data?.photo_exchange;
    return {
      hasPhoto: !!pe?.has_exchange_photo,
      url: pe?.viewer_exchange_photo_url || pe?.exchange_photo_url || '',
    };
  }

  function openPhotoExchange(mode) {
    if (!session) {
      router.push(`/login?redirect=${encodeURIComponent(`/mirror-card/${slug || ''}`)}`);
      return;
    }
    if (mode === 'respond') {
      const pe = data?.photo_exchange;
      const exId = pe?.exchange_id;
      if (exId) {
        const params = new URLSearchParams({
          action: 'respond',
          exchange: exId,
          redirect: `/mirror-card/${slug || ''}`,
        });
        if (slug) params.set('slug', slug);
        router.push(`/exchange-photo?${params.toString()}`);
        return;
      }
    }
    const snap = snapshotPhotoExchangeState();
    photoExchangeSnapshotRef.current = snap;
    setPhotoExchangeDraftUrl(null);
    setHasExchangePhoto(snap.hasPhoto);
    setExchangePhotoUrl(snap.url);
    setPhotoExchangeUploadKey((k) => k + 1);
    setPhotoExchangeError('');
    setPhotoExchangeMode(mode);
    setPhotoExchangeInitialStep('prepare');
    setPhotoExchangeOpen(true);
  }

  function closePhotoExchange() {
    if (photoExchangeBusy) return;
    const snap = photoExchangeSnapshotRef.current;
    setPhotoExchangeDraftUrl(null);
    setHasExchangePhoto(snap.hasPhoto);
    setExchangePhotoUrl(snap.url);
    setPhotoExchangeUploadKey((k) => k + 1);
    setPhotoExchangeError('');
    setPhotoExchangeInitialStep('prepare');
    setPhotoExchangeOpen(false);
  }

  async function persistDraftExchangePhoto() {
    if (!photoExchangeDraftUrl || !session?.access_token) return true;
    const r = await fetch('/api/profile/exchange-photo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ photo_url: photoExchangeDraftUrl }),
    });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) {
      setPhotoExchangeError(result.error || '儲存相片失敗。');
      return false;
    }
    const savedUrl = result.exchange_photo_url || photoExchangeDraftUrl;
    setExchangePhotoUrl(savedUrl);
    setHasExchangePhoto(true);
    setPhotoExchangeDraftUrl(null);
    photoExchangeSnapshotRef.current = { hasPhoto: true, url: savedUrl };
    return true;
  }

  async function confirmPhotoExchange() {
    const pe = data?.photo_exchange;
    if (!session?.access_token || photoExchangeBusy) return;

    setPhotoExchangeBusy(true);
    setPhotoExchangeError('');
    try {
      const photoSaved = await persistDraftExchangePhoto();
      if (!photoSaved) return;

      if (photoExchangeMode === 'request') {
        const r = await fetch('/api/photo-exchange/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ recipient_slug: slug }),
        });
        const result = await r.json().catch(() => ({}));
        if (!r.ok) {
          setPhotoExchangeError(result.error || '發起失敗，請稍後再試。');
          return;
        }
        setPhotoExchangeOpen(false);
        setPhotoExchangeNotice({ tone: 'ok', text: '交換邀請已發送！' });
        setData((prev) => {
          if (!prev?.photo_exchange) return prev;
          const prevPe = prev.photo_exchange;
          return {
            ...prev,
            photo_exchange: {
              ...prevPe,
              exchange_id: result.exchange_id || prevPe.exchange_id || null,
              status: 'pending',
              role: 'requester',
              can_request: false,
              can_respond: false,
              can_cancel: true,
              reason: 'pending_outgoing',
              quota_remaining:
                typeof result.quota_remaining === 'number'
                  ? result.quota_remaining
                  : prevPe.quota_remaining,
            },
          };
        });
      } else {
        const r = await fetch('/api/photo-exchange/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ exchange_id: pe?.exchange_id }),
        });
        const result = await r.json().catch(() => ({}));
        if (!r.ok) {
          setPhotoExchangeError(result.error || '回傳失敗，請稍後再試。');
          return;
        }
        setPhotoExchangeOpen(false);
        setPhotoExchangeNotice({ tone: 'ok', text: '交換成功！雙方可查看清晰相片 7 日。' });
      }
      await reloadCard();
    } catch {
      setPhotoExchangeError('網路錯誤，請重試。');
    } finally {
      setPhotoExchangeBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        {seo && (
          <SeoHead
            title={getMirrorCardPageTitle(seo.owner_name)}
            description={
              seo.family_zh
                ? `${seo.owner_name || '用戶'} 屬於${seo.family_zh}——在 Black Cat Under The Moon 探索靈魂鏡像與貓家族人格，測出妳的家族。`
                : `${seo.owner_name || '用戶'} 的 Mirror Card — 在 Black Cat Under The Moon 探索靈魂鏡像與貓家族人格。`
            }
            path={seo.slug ? `/mirror-card/${seo.slug}` : undefined}
            ogType="profile"
            ogImage={seo.og_image || undefined}
            ogImageAlt={seo.family_zh ? `${seo.family_zh} Mirror Card` : undefined}
          />
        )}
        <Head><link rel="stylesheet" href="/css/questionnaire.css" /></Head>
        <PageLoadingShell
          headerVariant="account"
          pageClassName="app-page--mirror-card"
          backHref="/index.html"
          nav={<AppHeaderAuth redirectPath="/mirror-card" />}
        />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <SeoHead title="Mirror Card" noindex />
        <Head><link rel="stylesheet" href="/css/questionnaire.css" /></Head>
        <AppShell
          title="Mirror Card"
          headerVariant="account"
          pageClassName="app-page--mirror-card"
          backHref="/index.html"
          nav={<AppHeaderAuth redirectPath="/mirror-card" />}
        >
          <div className="pixel-empty">
            <p className="pixel-subtitle">找不到這張 Mirror Card。</p>
            <a href="/index.html" className="pixel-btn pixel-btn--ghost">返回首頁</a>
          </div>
        </AppShell>
      </>
    );
  }

  const { card, owner, viewer_level, premium_locked, is_owner, messaging, photo_exchange: photoExchange } = data;
  const redirect = `/mirror-card/${encodeURIComponent(slug || '')}`;
  const exchangePhotoHref = is_owner
    ? `/exchange-photo?redirect=${encodeURIComponent(redirect)}`
    : `/exchange-photo?redirect=${encodeURIComponent(redirect)}&action=request`;
  const photoExchangeNoticeClass = photoExchangeNotice
    ? `mirror-report-notice mirror-report-notice--center mirror-report-notice--${photoExchangeNotice.tone || 'ok'}`
    : '';
  const mirrorCardTitle = getMirrorCardPageTitle(owner?.display_name);
  const ownerLabel = (owner?.display_name || '神秘貓咪').slice(0, 12);
  const visitorPremiumPerks = buildMirrorVisitorPremiumPerks({
    premiumLocked: premium_locked,
    messaging,
    photoExchange,
    session,
  });
  const showVisitorPremiumUpsell = visitorPremiumPerks.length > 0;
  const hidePhotoExchangePremiumPanel = showVisitorPremiumUpsell
    && photoExchange?.reason === 'premium_required'
    && !photoExchange?.can_respond;
  const useDualVisitorActions = !!session
    && data?.viewer_tier === 'premium'
    && messaging
    && photoExchange
    && !hidePhotoExchangePremiumPanel
    && messaging.reason !== 'blocked'
    && photoExchange.reason !== 'blocked';
  const headerTitle = (
    <span className="mirror-card-header-title">
      <AppHeaderMixedText
        text={mirrorCardTitle}
        zhClass="app-header__text-zh app-header__text-zh--title"
        enClass="app-header__text-en app-header__text-en--title"
      />
    </span>
  );

  return (
    <>
      <SeoHead
        title={mirrorCardTitle}
        description={
          seo?.family_zh
            ? `${ownerLabel || '用戶'} 屬於${seo.family_zh}——在 Black Cat Under The Moon 探索靈魂鏡像與貓家族人格，測出妳的家族。`
            : `${ownerLabel || '用戶'} 的 Mirror Card — 在 Black Cat Under The Moon 探索靈魂鏡像與貓家族人格。`
        }
        path={slug ? `/mirror-card/${slug}` : undefined}
        ogType="profile"
        ogImage={seo?.og_image || undefined}
        ogImageAlt={seo?.family_zh ? `${seo.family_zh} Mirror Card` : undefined}
      />
      <Head>
        <link rel="stylesheet" href="/css/questionnaire.css" />
      </Head>
      <MediaCaptureGuard />
      <AppShell
        title={headerTitle}
        backHref="/index.html"
        headerVariant="account"
        pageClassName={`app-page--mirror-card${!is_owner ? ' app-page--mirror-card--visitor' : ''}`}
        maxWidth="480px"
        nav={<AppHeaderAuth redirectPath={redirect} />}
      >
        <div className="mirror-card-wrap media-capture-guard">
          <MirrorPersonalityCard
            card={card}
            owner={owner}
            viewerLevel={viewer_level}
            isLoggedIn={!!session}
            isOwner={is_owner}
            slug={slug}
          />

          {is_owner ? (
            <MirrorOwnerBioSection bio={owner?.bio} displayName={owner?.display_name} />
          ) : null}

          {is_owner && session && photoExchange && (
            <div className="mirror-photo-exchange-wrap">
              <PhotoExchangePanel
                photoExchange={photoExchange}
                ownerName={owner?.display_name}
                busy={photoExchangeBusy}
                exchangePhotoHref={exchangePhotoHref}
                onRequest={() => openPhotoExchange('request')}
                onRespond={() => openPhotoExchange('respond')}
              />
              {photoExchangeNotice && (
                <p className={photoExchangeNoticeClass} role="status">
                  {photoExchangeNotice.text}
                </p>
              )}
            </div>
          )}

          {!is_owner && (
            <div className="mirror-card-visitor-panel">
              <MirrorOwnerBioSection
                bio={owner?.bio}
                displayName={owner?.display_name}
                variant="visitor"
              />

              {showVisitorPremiumUpsell && (
                <MirrorVisitorPremiumUpsell perks={visitorPremiumPerks} />
              )}

              {session && messaging && letterNotice?.ok && (
                <p className="mirror-report-notice mirror-report-notice--ok mirror-report-notice--center" role="status">
                  信件已發送！
                  {letterNotice.threadId && (
                    <>
                      {' '}
                      <Link href={`/inbox/${letterNotice.threadId}`} className="pixel-link">
                        查看對話 →
                      </Link>
                    </>
                  )}
                </p>
              )}

              {useDualVisitorActions && session && messaging && (
                <MirrorVisitorDualActions
                  messaging={messaging}
                  photoExchange={photoExchange}
                  ownerName={owner?.display_name}
                  busy={photoExchangeBusy}
                  onOpenLetter={openLetterComposer}
                  onPhotoRequest={() => openPhotoExchange('request')}
                  onPhotoRespond={() => openPhotoExchange('respond')}
                  exchangePhotoHref={exchangePhotoHref}
                />
              )}

              <div className="mirror-card-actions">
              {session && messaging && (
                <>
                  {!useDualVisitorActions && (
                    <>
                      {messaging.can_send && (
                        messaging.existing_thread_id ? (
                          <div className="mirror-action-row__primary">
                            <Link
                              href={`/inbox/${messaging.existing_thread_id}`}
                              className="mirror-letter-btn mirror-letter-btn--link"
                            >
                              <span className="mirror-letter-btn__icon" aria-hidden="true">
                                <HeaderMailIcon size={16} />
                              </span>
                              <span>查看對話</span>
                            </Link>
                            <button
                              type="button"
                              onClick={openLetterComposer}
                              className="mirror-letter-btn mirror-letter-btn--ghost"
                            >
                              再留一封信
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={openLetterComposer}
                            className="mirror-letter-btn mirror-letter-btn--full"
                          >
                            <span className="mirror-letter-btn__icon" aria-hidden="true">
                              <HeaderMailIcon size={16} />
                            </span>
                            <span>留信</span>
                          </button>
                        )
                      )}

                      {!messaging.can_send && messaging.reason === 'channel_active' && messaging.existing_thread_id && (
                        <Link
                          href={`/inbox/${messaging.existing_thread_id}`}
                          className="mirror-letter-btn mirror-letter-btn--full"
                        >
                          <span className="mirror-letter-btn__icon" aria-hidden="true">
                            <HeaderMailIcon size={16} />
                          </span>
                          <span>繼續對話</span>
                        </Link>
                      )}

                      {!messaging.can_send && messaging.reason === 'premium_required' && !showVisitorPremiumUpsell && (
                        <div className="mirror-letter-upsell">
                          <p className="mirror-letter-upsell__text">{MOONLIGHT_PASSPORT_BRAND} 可主動留信聯絡有共鳴的人</p>
                          <Link href="/premium" className="mirror-letter-btn mirror-letter-btn--ghost">
                            了解 {MOONLIGHT_PASSPORT_BRAND}
                          </Link>
                        </div>
                      )}

                      {!messaging.can_send && messaging.reason === 'quota_exhausted' && (
                        <p className="mirror-letter-upsell__text mirror-letter-upsell__text--warn">
                          本月主動投信額度已用完（每月 3 封）
                        </p>
                      )}

                      {!messaging.can_send && messaging.reason === 'blocked' && (
                        <p className="mirror-letter-upsell__text mirror-letter-upsell__text--warn">
                          無法聯絡此用戶
                        </p>
                      )}
                    </>
                  )}

                  {useDualVisitorActions && !messaging.can_send && messaging.reason === 'quota_exhausted' && (
                    <p className="mirror-letter-upsell__text mirror-letter-upsell__text--warn">
                      本月主動投信額度已用完（每月 3 封）
                    </p>
                  )}
                </>
              )}

              {session && photoExchange && !hidePhotoExchangePremiumPanel && !useDualVisitorActions && (
                <div className="mirror-photo-exchange-wrap">
                  <PhotoExchangePanel
                    photoExchange={photoExchange}
                    ownerName={owner?.display_name}
                    busy={photoExchangeBusy}
                    exchangePhotoHref={exchangePhotoHref}
                    onRequest={() => openPhotoExchange('request')}
                    onRespond={() => openPhotoExchange('respond')}
                  />
                  {photoExchangeNotice && (
                    <p className={photoExchangeNoticeClass} role="status">
                      {photoExchangeNotice.text}
                    </p>
                  )}
                </div>
              )}

              {useDualVisitorActions && photoExchangeNotice && (
                <p className={photoExchangeNoticeClass} role="status">
                  {photoExchangeNotice.text}
                </p>
              )}

              <div className="mirror-card-actions__footer">
                {reportNotice && (
                  <p
                    className={`mirror-report-notice mirror-report-notice--center${reportNotice.ok ? ' mirror-report-notice--ok' : ' mirror-report-notice--err'}`}
                    role="status"
                  >
                    {reportNotice.text}
                  </p>
                )}
                <button
                  type="button"
                  onClick={openReportConfirm}
                  disabled={reporting}
                  className="mirror-report-link"
                  title="檢舉此用戶"
                >
                  {reporting ? '提交中…' : '檢舉此用戶'}
                </button>
              </div>
            </div>
            </div>
          )}

          {!session && (
            <div className="pixel-card" style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
              <p className="pixel-subtitle" style={{ lineHeight: 1.6 }}>
                點擊卡片上的用戶名稱，登入後可查看更多資訊。<br />
                加入 Black Cat Under The Moon，生成你自己的 Mirror Card。
              </p>
              <div className="pixel-btn-row" style={{ justifyContent: 'center', marginTop: 8 }}>
                <Link href="/signup" className="pixel-btn pixel-btn--primary" style={{ width: 'auto', textDecoration: 'none' }}>
                  立即加入
                </Link>
                <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="pixel-link" style={{ alignSelf: 'center', fontSize: 13 }}>
                  已有帳號？登入
                </Link>
              </div>
            </div>
          )}
        </div>
      </AppShell>
      <MirrorReportConfirmOverlay
        open={reportConfirmOpen}
        confirming={reporting}
        onConfirm={submitReport}
        onCancel={() => { if (!reporting) setReportConfirmOpen(false); }}
      />
      <MirrorLetterOverlay
        open={letterOpen}
        ownerName={owner?.display_name}
        content={letterContent}
        onContentChange={setLetterContent}
        onSend={submitLetter}
        onCancel={() => { if (!letterSending) setLetterOpen(false); }}
        sending={letterSending}
        error={letterError}
        composeMode={messaging?.compose_mode || 'open'}
        composeTitle={messaging?.compose_title}
        composeHint={messaging?.compose_hint || null}
        letterPrefs={letterPrefs}
        onLetterPrefsChange={saveLetterPrefs}
        viewerTier={data?.viewer_tier || 'free'}
      />
      <PhotoExchangeOverlay
        open={photoExchangeOpen}
        mode={photoExchangeMode}
        ownerName={owner?.display_name}
        accessToken={session?.access_token}
        hasExchangePhoto={!!(photoExchangeDraftUrl || exchangePhotoUrl)}
        hasDraft={!!photoExchangeDraftUrl}
        exchangePhotoUrl={photoExchangeDraftUrl || exchangePhotoUrl}
        uploadKey={photoExchangeUploadKey}
        initialStep={photoExchangeInitialStep}
        onExchangePhotoSaved={(url) => {
          setPhotoExchangeDraftUrl(url || null);
        }}
        onConfirm={confirmPhotoExchange}
        onBeforeConfirm={() => setPhotoExchangeError('')}
        onCancel={closePhotoExchange}
        busy={photoExchangeBusy}
        error={photoExchangeError}
      />
    </>
  );
}

/**
 * SSR meta for crawlers: unique title/description per card (family + owner)
 * in the initial HTML, and real 404s for unknown slugs.
 */
export async function getServerSideProps({ params, res }) {
  const slug = String(params?.slug || '').trim();
  if (!slug || slug.length > 80) return { notFound: true };

  try {
    const { getAdminClient } = await import('../../lib/server-auth.js');
    const admin = getAdminClient();
    const { data: card } = await admin
      .from('mirror_cards')
      .select('public_slug, mirror_type, user_id')
      .eq('public_slug', slug)
      .maybeSingle();

    if (!card) return { notFound: true };

    let ownerName = null;
    if (card.user_id) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('display_name, status')
        .eq('id', card.user_id)
        .maybeSingle();
      if (ownerProfile?.status && ownerProfile.status !== 'active') {
        return { notFound: true };
      }
      ownerName = (ownerProfile?.display_name || '').slice(0, 12) || null;
    }

    const family = PERSONALITY_TYPES[card.mirror_type] || null;

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

    return {
      props: {
        seo: {
          slug: card.public_slug,
          owner_name: ownerName,
          family_zh: family?.nameZh || null,
          og_image: CAT_IMG_MAP[card.mirror_type] || null,
        },
      },
    };
  } catch (err) {
    console.error('[mirror-card/slug] SSR meta failed:', err?.message || err);
    return { props: { seo: null } };
  }
}
