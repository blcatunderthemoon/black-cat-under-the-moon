/**
 * Two-step photo exchange overlay: upload interface → confirm on submit.
 */

import { useState, useEffect } from 'react';
import ExchangePhotoUpload from './ExchangePhotoUpload.js';

function PhotoExchangeCloseConfirm({ open, mode, onConfirm, onCancel, busy }) {
  if (!open) return null;
  const isRequest = mode === 'request';
  const sub = isRequest
    ? '關閉後將清除已選擇的相片，交換邀請不會發送。'
    : '關閉後將清除已選擇的相片，交換不會完成。';

  return (
    <div
      className="mirror-report-overlay show photo-exchange-close-confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="photo-exchange-close-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="mirror-report-overlay__box">
        <span className="mirror-report-overlay__icon" aria-hidden="true">✕</span>
        <div className="mirror-report-overlay__title" id="photo-exchange-close-confirm-title">
          確認關閉？
        </div>
        <div className="mirror-report-overlay__sub">{sub}</div>
        <button
          type="button"
          className="mirror-report-overlay__confirm"
          onClick={onConfirm}
          disabled={busy}
        >
          確認關閉
        </button>
        <button
          type="button"
          className="mirror-report-overlay__cancel"
          onClick={onCancel}
          disabled={busy}
        >
          繼續編輯
        </button>
      </div>
    </div>
  );
}

export default function PhotoExchangeOverlay({
  open,
  mode,
  ownerName,
  accessToken,
  hasExchangePhoto,
  hasDraft = false,
  exchangePhotoUrl = '',
  initialStep = 'prepare',
  onExchangePhotoSaved,
  onConfirm,
  onCancel,
  onBeforeConfirm,
  busy,
  error,
  uploadKey = 0,
}) {
  const [step, setStep] = useState('prepare');
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setCloseConfirmOpen(false);
    }
  }, [open, initialStep]);

  if (!open) return null;

  const label = (ownerName || '對方').slice(0, 12);
  const isRequest = mode === 'request';

  function shouldConfirmClose() {
    return hasDraft || step === 'confirm';
  }

  function requestClose() {
    if (busy) return;
    if (shouldConfirmClose()) {
      setCloseConfirmOpen(true);
      return;
    }
    onCancel?.();
  }

  function confirmClose() {
    setCloseConfirmOpen(false);
    onCancel?.();
  }

  if (step === 'confirm') {
    const title = isRequest ? '發起交換相？' : '回傳相片以解鎖';
    const sub = isRequest
      ? `向 ${label} 發送交換邀請。對方回傳相片時才會扣你 1 次配額；成功後雙方可查看清晰相片 7 日。`
      : `上傳你的真人相片以完成與 ${label} 的交換。完成後雙方可查看清晰相片 7 日。`;
    const confirmLabel = isRequest ? '確認' : '確認完成交換';

    return (
      <>
        <div
          className="mirror-report-overlay show"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-exchange-overlay-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy && !closeConfirmOpen) requestClose();
          }}
        >
          <div className="mirror-report-overlay__box photo-exchange-overlay__box">
            <button
              type="button"
              className="mirror-overlay-close"
              aria-label="關閉"
              disabled={busy}
              onClick={requestClose}
            >
              ✕
            </button>
          <span className="mirror-report-overlay__icon" aria-hidden="true">📷</span>
          <div className="mirror-report-overlay__title" id="photo-exchange-overlay-title">
            {title}
          </div>
          <div className="mirror-report-overlay__sub">{sub}</div>

          {exchangePhotoUrl && (
            <div className="photo-exchange-overlay__confirm-preview">
              <img
                src={exchangePhotoUrl}
                alt="你的交換用相片預覽"
                className="photo-exchange-upload__preview"
              />
            </div>
          )}

          {error && <p className="pixel-error photo-exchange-overlay__error">{error}</p>}

          <div className="photo-exchange-overlay__btns">
            <button
              type="button"
              className="mirror-report-overlay__confirm"
              onClick={onConfirm}
              disabled={!hasExchangePhoto || busy}
            >
              {busy ? '處理中…' : confirmLabel}
            </button>
            <button
              type="button"
              className="mirror-report-overlay__cancel"
              onClick={() => {
                if (!busy) setStep('prepare');
              }}
              disabled={busy}
            >
              返回
            </button>
          </div>
        </div>
      </div>
        <PhotoExchangeCloseConfirm
          open={closeConfirmOpen}
          mode={mode}
          busy={busy}
          onConfirm={confirmClose}
          onCancel={() => setCloseConfirmOpen(false)}
        />
      </>
    );
  }

  const prepareTitle = isRequest ? '發起交換相' : '回傳相片以解鎖';
  const prepareSub = isRequest
    ? `向 ${label} 發送交換邀請前，請先準備你的真人相片。對方回傳時才會扣配額。`
    : `上傳你的真人相片以完成與 ${label} 的交換。完成後雙方可查看清晰相片 7 日。`;
  const submitLabel = isRequest ? '發送邀請' : '提交交換';

  return (
    <>
      <div
        className="mirror-report-overlay show"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-exchange-overlay-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy && !closeConfirmOpen) requestClose();
        }}
      >
        <div className="mirror-report-overlay__box photo-exchange-overlay__box photo-exchange-overlay__box--prepare">
          <button
            type="button"
            className="mirror-overlay-close"
            aria-label="關閉"
            disabled={busy}
            onClick={requestClose}
          >
            ✕
          </button>
        <span className="mirror-report-overlay__icon" aria-hidden="true">📷</span>
        <div className="mirror-report-overlay__title" id="photo-exchange-overlay-title">
          {prepareTitle}
        </div>
        <div className="mirror-report-overlay__sub">{prepareSub}</div>

        {accessToken && (
          <div className="photo-exchange-overlay__upload">
            <ExchangePhotoUpload
              key={uploadKey}
              accessToken={accessToken}
              currentUrl={exchangePhotoUrl}
              layout="page"
              saveToProfile={false}
              onSaved={(url) => onExchangePhotoSaved?.(url)}
            />
          </div>
        )}

        {error && <p className="pixel-error photo-exchange-overlay__error">{error}</p>}

        <div className="photo-exchange-overlay__btns">
          <button
            type="button"
            className="mirror-report-overlay__confirm"
            onClick={() => {
              onBeforeConfirm?.();
              setStep('confirm');
            }}
            disabled={!hasExchangePhoto || busy}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
      <PhotoExchangeCloseConfirm
        open={closeConfirmOpen}
        mode={mode}
        busy={busy}
        onConfirm={confirmClose}
        onCancel={() => setCloseConfirmOpen(false)}
      />
    </>
  );
}
