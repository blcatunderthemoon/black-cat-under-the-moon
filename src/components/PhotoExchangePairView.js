/**
 * Side-by-side photo exchange display — respond (blur), completed, or waiting.
 */

import PixelMoonIcon from './PixelMoonIcon.js';
import { useExchangeExpiryCountdown } from '../lib/use-exchange-expiry-countdown.js';

function ExchangeExpiryCountdown({ expiresAt, daysRemaining = 0 }) {
  const live = useExchangeExpiryCountdown(expiresAt);

  if (expiresAt) {
    if (!live.label || live.expired) return null;
    return (
      <p className="photo-exchange-pair__expiry" role="timer" aria-live="polite">
        <span className="photo-exchange-pair__expiry-icon" aria-hidden="true">⏳</span>
        <span className="photo-exchange-pair__expiry-text">{live.label}</span>
      </p>
    );
  }

  if (daysRemaining <= 0) return null;

  return (
    <p className="photo-exchange-pair__expiry">
      <span className="photo-exchange-pair__expiry-icon" aria-hidden="true">⏳</span>
      <span className="photo-exchange-pair__expiry-text">雙方相片尚可查看 {daysRemaining} 日</span>
    </p>
  );
}

function PhotoFrame({
  url,
  label,
  badge,
  isMine = false,
  blurred = false,
  placeholder,
  placeholderIcon,
}) {
  return (
    <div className={`photo-exchange-pair__card${isMine ? ' photo-exchange-pair__card--mine' : ''}${blurred ? ' photo-exchange-pair__card--blur' : ''}`}>
      <div className="photo-exchange-pair__name-row">
        <span className="photo-exchange-pair__name">{label}</span>
      </div>
      <div className={`photo-exchange-pair__frame${!url && placeholder ? ' photo-exchange-pair__frame--placeholder' : ''}`}>
        {badge && (
          <span className="photo-exchange-pair__you-tag" aria-label="你的相片">
            <span className="photo-exchange-pair__you-tag-text">{badge}</span>
          </span>
        )}
        {url ? (
          <>
            <img
              src={url}
              alt={blurred ? '' : `${label}的交換相片`}
              aria-hidden={blurred || undefined}
              className={`photo-exchange-pair__img${blurred ? ' photo-exchange-pair__img--blurred' : ''}`}
              decoding="async"
              fetchPriority="high"
              draggable={false}
            />
            <div className="media-capture-guard__shield" aria-hidden="true" />
            {blurred && <div className="photo-exchange-pair__blur-overlay" aria-hidden="true" />}
            {blurred && <div className="photo-exchange-pair__frame-scan" aria-hidden="true" />}
          </>
        ) : (
          <div className="photo-exchange-pair__placeholder">
            <span className="photo-exchange-pair__placeholder-icon" aria-hidden="true">
              {placeholderIcon || '📷'}
            </span>
            {placeholder && (
              <span className="photo-exchange-pair__placeholder-text">{placeholder}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhotoExchangePairView({
  myPhotoUrl,
  otherPhotoUrl,
  otherBlurredUrl,
  myLabel = '你',
  otherLabel = '對方',
  daysRemaining = 0,
  showSuccessHeader = false,
  otherBlurred = false,
  otherPlaceholder,
  otherPlaceholderIcon,
  hint,
  expiresAt = null,
}) {
  const otherUrl = otherBlurred ? otherBlurredUrl : otherPhotoUrl;

  return (
    <div className="photo-exchange-pair">
      {showSuccessHeader && (
        <header className="photo-exchange-pair__success" role="status">
          <span className="photo-exchange-pair__success-icon" aria-hidden="true">✓</span>
          <p className="photo-exchange-pair__success-text">交換完成！</p>
        </header>
      )}

      <div className="photo-exchange-pair__stage">
        <PhotoFrame
          url={myPhotoUrl}
          label={myLabel}
          badge="你"
          isMine
        />

        <div className="photo-exchange-pair__connector" aria-hidden="true">
          <span className="photo-exchange-pair__connector-line" />
          <div className="photo-exchange-pair__connector-moon-wrap">
            <PixelMoonIcon size={22} className="photo-exchange-pair__connector-moon" />
          </div>
          <span className="photo-exchange-pair__connector-line" />
        </div>

        <PhotoFrame
          url={otherUrl}
          label={otherLabel}
          blurred={otherBlurred && !!otherBlurredUrl}
          placeholder={!otherUrl ? otherPlaceholder : null}
          placeholderIcon={otherPlaceholderIcon}
        />
      </div>

      {hint && (
        <p className="photo-exchange-pair__hint pixel-subtitle">{hint}</p>
      )}

      {(expiresAt || daysRemaining > 0) && (
        <ExchangeExpiryCountdown expiresAt={expiresAt} daysRemaining={daysRemaining} />
      )}
    </div>
  );
}
