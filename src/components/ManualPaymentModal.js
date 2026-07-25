/**
 * PayMe QR manual payment instructions overlay.
 * QR image is fetched via authenticated API (login required).
 */

import { useEffect, useState } from 'react';
import {
  MANUAL_PAYMENT_AMOUNT_HKD,
  MANUAL_PAYMENT_PAYME_LINK,
  MANUAL_PAYMENT_PAYME_STEPS,
} from '../lib/manual-payment.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';
import PixelMixedLabel from './PixelMixedLabel.js';
import { ForumMoonIcon } from './UiIcons.js';

export default function ManualPaymentModal({ open, onClose, accessToken }) {
  const [qrSrc, setQrSrc] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    if (!open) {
      setQrSrc(null);
      setQrError('');
      setQrLoading(false);
      return undefined;
    }

    if (!accessToken) {
      setQrSrc(null);
      setQrError('請先登入後再查看 PayMe QR Code。');
      setQrLoading(false);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setQrLoading(true);
    setQrError('');
    setQrSrc(null);

    fetch('/api/billing/payme-qr', {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error('login_required');
        }
        if (!res.ok) {
          throw new Error('qr_unavailable');
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setQrSrc(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setQrSrc(null);
        setQrError(
          err?.message === 'login_required'
            ? '請先登入後再查看 PayMe QR Code。'
            : '無法載入 QR Code，請稍後再試。',
        );
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, accessToken]);

  if (!open) return null;

  return (
    <div
      className="manual-payment-overlay show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-payment-title"
      onClick={onClose}
    >
      <div
        className="manual-payment-overlay__box"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="manual-payment-overlay__close" onClick={onClose} aria-label="關閉">
          ✕
        </button>

        <div className="manual-payment-overlay__hero">
          <span className="manual-payment-overlay__icon" aria-hidden="true"><ForumMoonIcon size={28} /></span>
          <h2 className="manual-payment-overlay__title" id="manual-payment-title">
            PayMe 掃碼付款
          </h2>
          <p className="manual-payment-overlay__sub">
            {MOONLIGHT_PASSPORT_BRAND} · HKD {MANUAL_PAYMENT_AMOUNT_HKD} / 月
          </p>
        </div>

        <div className="manual-payment-overlay__qr-panel">
          <div className="manual-payment-overlay__qr-wrap">
            {qrLoading && (
              <p className="manual-payment-overlay__qr-status">載入 QR Code…</p>
            )}
            {!qrLoading && qrError && (
              <p className="manual-payment-overlay__qr-status manual-payment-overlay__qr-status--error">
                {qrError}
              </p>
            )}
            {!qrLoading && qrSrc && (
              <img
                src={qrSrc}
                alt="Black Cat Under The Moon PayMe 收款 QR Code"
                className="manual-payment-overlay__qr"
                width={240}
                height={240}
              />
            )}
          </div>
          {qrSrc && (
            <p className="manual-payment-overlay__qr-hint">一掃 PayCode，立即過數</p>
          )}
        </div>

        <div className="manual-payment-overlay__section">
          <p className="manual-payment-overlay__section-title">付款步驟</p>
          <ol className="manual-payment-overlay__steps">
            {MANUAL_PAYMENT_PAYME_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          {MANUAL_PAYMENT_PAYME_LINK ? (
            <a
              href={MANUAL_PAYMENT_PAYME_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="pixel-btn pixel-btn--ghost manual-payment-overlay__payme-link"
            >
              <PixelMixedLabel text="開啟 PayMe 連結" />
            </a>
          ) : null}
        </div>

        <p className="manual-payment-overlay__footnote">
          人手核對後開通，無自動扣款。
        </p>
      </div>
    </div>
  );
}
