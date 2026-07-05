/**
 * PayMe QR manual payment instructions overlay.
 */

import {
  MANUAL_PAYMENT_AMOUNT_HKD,
  MANUAL_PAYMENT_PAYME_LINK,
  MANUAL_PAYMENT_PAYME_STEPS,
  MANUAL_PAYMENT_QR_URL,
} from '../lib/manual-payment.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';
import PixelMixedLabel from './PixelMixedLabel.js';

export default function ManualPaymentModal({ open, onClose }) {
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
          <span className="manual-payment-overlay__icon" aria-hidden="true">🌙</span>
          <h2 className="manual-payment-overlay__title" id="manual-payment-title">
            PayMe 掃碼付款
          </h2>
          <p className="manual-payment-overlay__sub">
            {MOONLIGHT_PASSPORT_BRAND} · HKD {MANUAL_PAYMENT_AMOUNT_HKD} / 月
          </p>
        </div>

        {MANUAL_PAYMENT_QR_URL ? (
          <div className="manual-payment-overlay__qr-panel">
            <div className="manual-payment-overlay__qr-wrap">
              <img
                src={MANUAL_PAYMENT_QR_URL}
                alt="Black Cat Under The Moon PayMe 收款 QR Code"
                className="manual-payment-overlay__qr"
                width={240}
                height={240}
              />
            </div>
            <p className="manual-payment-overlay__qr-hint">一掃 PayCode，立即過數</p>
          </div>
        ) : null}

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
