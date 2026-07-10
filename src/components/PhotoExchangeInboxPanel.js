/**
 * Inbox photo-exchange thread — inline respond / view UI (no Mirror Card redirect).
 */

import { useState, useEffect } from 'react';
import ExchangePhotoUpload from './ExchangePhotoUpload.js';
import PhotoExchangePairView from './PhotoExchangePairView.js';
import PhotoExchangeMirrorCardBtn from './PhotoExchangeMirrorCardBtn.js';
import PhotoExchangeCompletedShell from './PhotoExchangeCompletedShell.js';
import MoonLoading from './MoonLoading.js';

function prefetchImage(url) {
  if (!url || typeof window === 'undefined') return;
  const img = new window.Image();
  img.decoding = 'async';
  img.src = url;
}

function applyExchangeDetail(detail, {
  setExchangeDetail,
  setViewerName,
  setRevealedOtherPhoto,
  setRevealedDays,
  setRevealedExpiresAt,
  setRevealedMyPhoto,
  setExchangePhotoUrl,
  viewerNameFallback,
  viewerPhotoFallback,
}) {
  if (!detail?.ok) return;
  setExchangeDetail(detail);
  if (detail.viewer_name) setViewerName(detail.viewer_name);
  if (detail.other_party_photo_url) {
    setRevealedOtherPhoto(detail.other_party_photo_url);
    setRevealedDays(detail.days_remaining || 0);
    setRevealedExpiresAt(detail.expires_at || null);
    prefetchImage(detail.other_party_photo_url);
  }
  if (detail.blurred_preview_url) {
    prefetchImage(detail.blurred_preview_url);
  }
  const myPhoto = detail.viewer_photo_url || viewerPhotoFallback || '';
  if (myPhoto) {
    setRevealedMyPhoto(myPhoto);
    setExchangePhotoUrl(myPhoto);
    prefetchImage(myPhoto);
  }
  if (viewerNameFallback) setViewerName(viewerNameFallback);
}

export default function PhotoExchangeInboxPanel({
  exchangeId,
  accessToken,
  initialDetail = null,
  initialViewerName = null,
  initialViewerPhotoUrl = null,
  onComplete,
}) {
  const hasInitial = Boolean(initialDetail?.ok);
  const [exchangeDetail, setExchangeDetail] = useState(hasInitial ? initialDetail : null);
  const [exchangeLoading, setExchangeLoading] = useState(!hasInitial);
  const [exchangePhotoUrl, setExchangePhotoUrl] = useState(
    initialDetail?.viewer_photo_url || initialViewerPhotoUrl || '',
  );
  const [viewerName, setViewerName] = useState(
    initialViewerName || initialDetail?.viewer_name || '你',
  );
  const [respondBusy, setRespondBusy] = useState(false);
  const [respondError, setRespondError] = useState('');
  const [justCompleted, setJustCompleted] = useState(false);
  const [revealedOtherPhoto, setRevealedOtherPhoto] = useState(
    initialDetail?.other_party_photo_url || '',
  );
  const [revealedMyPhoto, setRevealedMyPhoto] = useState(
    initialDetail?.viewer_photo_url || initialViewerPhotoUrl || '',
  );
  const [revealedDays, setRevealedDays] = useState(initialDetail?.days_remaining || 0);
  const [revealedExpiresAt, setRevealedExpiresAt] = useState(initialDetail?.expires_at || null);

  useEffect(() => {
    if (!initialDetail?.ok) return;
    applyExchangeDetail(initialDetail, {
      setExchangeDetail,
      setViewerName,
      setRevealedOtherPhoto,
      setRevealedDays,
      setRevealedExpiresAt,
      setRevealedMyPhoto,
      setExchangePhotoUrl,
      viewerNameFallback: initialViewerName,
      viewerPhotoFallback: initialViewerPhotoUrl,
    });
    setExchangeLoading(false);
  }, [initialDetail, initialViewerName, initialViewerPhotoUrl]);

  useEffect(() => {
    if (!accessToken || !exchangeId || hasInitial) return;
    let cancelled = false;
    setExchangeLoading(true);

    fetch(`/api/photo-exchange/${encodeURIComponent(exchangeId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        applyExchangeDetail(data, {
          setExchangeDetail,
          setViewerName,
          setRevealedOtherPhoto,
          setRevealedDays,
          setRevealedExpiresAt,
          setRevealedMyPhoto,
          setExchangePhotoUrl,
          viewerNameFallback: initialViewerName,
          viewerPhotoFallback: initialViewerPhotoUrl,
        });
      })
      .finally(() => {
        if (!cancelled) setExchangeLoading(false);
      });

    return () => { cancelled = true; };
  }, [accessToken, exchangeId, hasInitial, initialViewerName, initialViewerPhotoUrl]);

  async function handleCompleteExchange() {
    if (!accessToken || !exchangeId || respondBusy || !exchangePhotoUrl) return;
    setRespondBusy(true);
    setRespondError('');
    try {
      const r = await fetch('/api/photo-exchange/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          exchange_id: exchangeId,
          photo_url: exchangePhotoUrl,
        }),
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRespondError(result.error || '完成交換失敗，請稍後再試。');
        return;
      }
      if (result.other_party_photo_url) {
        setRevealedOtherPhoto(result.other_party_photo_url);
        prefetchImage(result.other_party_photo_url);
      }
      if (result.viewer_photo_url) {
        setRevealedMyPhoto(result.viewer_photo_url);
        prefetchImage(result.viewer_photo_url);
      }
      setRevealedDays(result.days_remaining || 0);
      setRevealedExpiresAt(result.expires_at || null);
      setJustCompleted(true);
      onComplete?.();
    } catch {
      setRespondError('網路錯誤，請重試。');
    } finally {
      setRespondBusy(false);
    }
  }

  if (!exchangeId) return null;

  if (exchangeLoading) {
    return (
      <div className="photo-exchange-inbox-panel">
        <MoonLoading size={28} />
      </div>
    );
  }

  if (!exchangeDetail) {
    return (
      <div className="photo-exchange-inbox-panel">
        <p className="pixel-muted">找不到交換紀錄。</p>
      </div>
    );
  }

  const otherName = exchangeDetail.other_party_name || '對方';
  const otherPhoto = revealedOtherPhoto || exchangeDetail.other_party_photo_url || '';
  const myPhoto = revealedMyPhoto || exchangeDetail.viewer_photo_url || exchangePhotoUrl || '';
  const isViewMode = Boolean(otherPhoto);
  const isWaitingMode = exchangeDetail.status === 'pending' && exchangeDetail.role === 'requester';
  const isRespondMode = exchangeDetail.can_respond && !isViewMode;
  const daysRemaining = revealedDays || exchangeDetail.days_remaining || 0;
  const expiresAt = revealedExpiresAt || exchangeDetail.expires_at || null;

  if (isViewMode && otherPhoto) {
    return (
      <PhotoExchangeCompletedShell
        footer={exchangeDetail.other_party_slug ? (
          <PhotoExchangeMirrorCardBtn
            href={`/mirror-card/${encodeURIComponent(exchangeDetail.other_party_slug)}`}
          />
        ) : null}
      >
        <PhotoExchangePairView
          myPhotoUrl={myPhoto}
          otherPhotoUrl={otherPhoto}
          myLabel={viewerName}
          otherLabel={otherName}
          daysRemaining={daysRemaining}
          expiresAt={expiresAt}
          showSuccessHeader={justCompleted}
        />
      </PhotoExchangeCompletedShell>
    );
  }

  if (isWaitingMode) {
    return (
      <div className="photo-exchange-inbox-panel photo-exchange-inbox-panel--waiting">
        <div className="pixel-card pixel-card--moon photo-exchange-inbox-panel__shell">
          <PhotoExchangePairView
            myPhotoUrl={myPhoto}
            myLabel={viewerName}
            otherLabel={otherName}
            otherPlaceholder="等待回傳"
            otherPlaceholderIcon="⏳"
            hint={`邀請已發送，等待 ${otherName} 回傳相片…`}
          />
        </div>
      </div>
    );
  }

  if (exchangeDetail.status !== 'pending') {
    return (
      <div className="photo-exchange-inbox-panel">
        <p className="pixel-muted">此交換邀請已結束。</p>
      </div>
    );
  }

  return (
    <div className="photo-exchange-inbox-panel photo-exchange-inbox-panel--respond">
      <div className="photo-exchange-inbox-panel__shell">
        <p className="photo-exchange-inbox-panel__intro">
          {isRespondMode
            ? `${otherName} 想與你交換真人相片`
            : '交換相邀請'}
        </p>

        <PhotoExchangePairView
          myPhotoUrl={exchangePhotoUrl || null}
          otherBlurredUrl={exchangeDetail.blurred_preview_url}
          otherBlurred={isRespondMode}
          myLabel={viewerName}
          otherLabel={otherName}
          hint={isRespondMode ? '上傳你的相片後可查看對方清晰版本' : null}
        />

        {isRespondMode && (
          <div className="photo-exchange-inbox-panel__upload-zone">
            <ExchangePhotoUpload
              layout="page"
              accessToken={accessToken}
              currentUrl={exchangePhotoUrl}
              onSaved={(url) => setExchangePhotoUrl(url || '')}
              hideSelectButton={Boolean(exchangePhotoUrl)}
            />
          </div>
        )}

        {isRespondMode && (
          <div className="photo-exchange-inbox-panel__actions">
            {respondError && (
              <p className="pixel-error photo-exchange-inbox-panel__error" role="alert">
                {respondError}
              </p>
            )}
            <button
              type="button"
              className={`pixel-btn pixel-btn--primary photo-exchange-inbox-panel__submit${exchangePhotoUrl ? ' photo-exchange-inbox-panel__submit--ready' : ''}`}
              onClick={handleCompleteExchange}
              disabled={!exchangePhotoUrl || respondBusy}
            >
              {respondBusy ? '交換中…' : '完成交換'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
