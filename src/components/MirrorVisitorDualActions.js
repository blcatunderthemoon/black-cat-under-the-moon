/**
 * Premium visitor — side-by-side 留信 + 交換相 actions (aligned with bio section).
 */

import Link from 'next/link';
import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';

function DualIcon({ variant }) {
  const svgProps = {
    className: 'mirror-dual-btn__glyph',
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (variant === 'letter') {
    return (
      <svg {...svgProps}>
        <rect x="3" y="5.5" width="18" height="13" rx="0.5" />
        <path d="M3 7.5 12 13.5 21 7.5" />
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      <path d="M6 8.5h2.8L11.2 6.5h1.6l2.4 2h2.8v9.5H6V8.5z" />
      <circle cx="12" cy="12.8" r="2.8" />
    </svg>
  );
}

function DualButton({
  as = 'button',
  href,
  onClick,
  disabled,
  label,
  sub,
  variant,
}) {
  const className = `mirror-dual-btn mirror-dual-btn--${variant}${disabled ? ' mirror-dual-btn--disabled' : ''}`;
  const icon = (
    <span className="mirror-dual-btn__icon">
      <DualIcon variant={variant} />
    </span>
  );

  if (as === 'link' && href) {
    return (
      <Link href={href} className={className}>
        {icon}
        <span className="mirror-dual-btn__label">{label}</span>
        {sub && <span className="mirror-dual-btn__sub">{sub}</span>}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {icon}
      <span className="mirror-dual-btn__label">{label}</span>
      {sub && <span className="mirror-dual-btn__sub">{sub}</span>}
    </button>
  );
}

export default function MirrorVisitorDualActions({
  messaging,
  photoExchange,
  ownerName,
  busy,
  onOpenLetter,
  onPhotoRequest,
  onPhotoRespond,
  exchangePhotoHref = '/exchange-photo',
}) {
  const label = (ownerName || '對方').slice(0, 12);

  let letterAs = 'button';
  let letterHref;
  let letterOnClick = onOpenLetter;
  let letterLabel = '留信';
  let letterDisabled = false;

  if (messaging.existing_thread_id && !messaging.can_send) {
    letterAs = 'link';
    letterHref = `/inbox/${messaging.existing_thread_id}`;
    letterLabel = messaging.reason === 'channel_active' ? '繼續對話' : '查看對話';
    letterOnClick = undefined;
  } else if (messaging.existing_thread_id && messaging.can_send) {
    letterLabel = '留信';
  } else if (!messaging.can_send) {
    letterDisabled = true;
    if (messaging.reason === 'quota_exhausted') letterLabel = '額度已滿';
    else letterLabel = '留信';
  }

  let photoAs = 'button';
  let photoHref;
  let photoOnClick = onPhotoRequest;
  let photoLabel = '交換相';
  let photoSub;
  let photoDisabled = busy;

  if (photoExchange.can_respond) {
    photoOnClick = onPhotoRespond;
    photoLabel = '交換相';
    photoSub = '回傳解鎖';
  } else if (photoExchange.reason === 'exchange_active' && photoExchange.exchange_id) {
    photoAs = 'link';
    photoHref = `/exchange-photo?exchange=${encodeURIComponent(photoExchange.exchange_id)}`;
    photoLabel = '交換相';
    photoSub = '查看相片';
  } else if (photoExchange.reason === 'pending_outgoing') {
    photoLabel = '交換相';
    photoSub = '等待回覆';
    photoDisabled = true;
  } else if (photoExchange.reason === 'photo_required') {
    photoAs = 'link';
    photoHref = exchangePhotoHref;
    photoLabel = '交換相';
    photoSub = '先上傳相片';
  } else if (photoExchange.can_request) {
    photoOnClick = onPhotoRequest;
    photoLabel = '交換相';
    if (typeof photoExchange.quota_remaining === 'number') {
      photoSub = `本月 ${photoExchange.quota_remaining}/${photoExchange.quota_limit || 3}`;
    }
  } else if (photoExchange.reason === 'quota_exhausted') {
    photoLabel = '交換相';
    photoSub = '額度已滿';
    photoDisabled = true;
  }

  const showBlurredPreview = photoExchange.can_respond
    && photoExchange.owner_photo?.mode === 'blurred'
    && photoExchange.owner_photo?.blurred_url;

  return (
    <section
      className="mirror-card-bio mirror-card-bio--visitor mirror-card-bio--passport"
      aria-label={`${MOONLIGHT_PASSPORT_BRAND} 專屬聯絡`}
    >
      <div className="mirror-card-bio__glow" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--tl" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--tr" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--bl" aria-hidden="true" />
      <span className="mirror-card-bio__rivet mirror-card-bio__rivet--br" aria-hidden="true" />

      <header className="mirror-card-bio__head">
        <span className="mirror-card-bio__icon mirror-card-bio__icon--moon" aria-hidden="true">🌙</span>
        <div className="mirror-card-bio__head-text">
          <p className="mirror-card-bio__eyebrow">
            <span className="mirror-card-bio__eyebrow-prefix" aria-hidden="true">//</span>
            <span className="mirror-card-bio__eyebrow-label mirror-card-bio__eyebrow-label--passport">
              {MOONLIGHT_PASSPORT_BRAND}
            </span>
            <span className="mirror-card-bio__eyebrow-line" aria-hidden="true" />
          </p>
          <h2 className="mirror-card-bio__title">會員專屬聯絡</h2>
        </div>
      </header>

      <div className="mirror-card-bio__body mirror-card-bio__body--passport">
        <p className="mirror-card-bio__passport-hint">
          主動留信與交換相僅限 {MOONLIGHT_PASSPORT_BRAND} 會員使用。
        </p>

        <div className="mirror-dual-actions">
          {showBlurredPreview && (
            <div className="mirror-dual-actions__preview">
              <div className="photo-exchange-panel__photo-wrap photo-exchange-panel__photo-wrap--blur">
                <img
                  src={photoExchange.owner_photo.blurred_url}
                  alt=""
                  aria-hidden="true"
                  className="photo-exchange-panel__photo photo-exchange-panel__photo--blurred"
                  draggable={false}
                />
                <div className="photo-exchange-panel__blur-overlay" aria-hidden="true" />
              </div>
              <p className="mirror-dual-actions__preview-hint">
                {label} 已附上相片預覽，回傳你的相片以解鎖清晰版本。
              </p>
            </div>
          )}

          <div className="mirror-dual-actions__row">
            <DualButton
              as={letterAs}
              href={letterHref}
              onClick={letterOnClick}
              disabled={letterDisabled || busy}
              label={letterLabel}
              variant="letter"
            />
            <DualButton
              as={photoAs}
              href={photoHref}
              onClick={photoOnClick}
              disabled={photoDisabled}
              label={photoLabel}
              sub={photoSub}
              variant="photo"
            />
          </div>

          {messaging.existing_thread_id && messaging.can_send && (
            <p className="mirror-dual-actions__foot">
              <Link href={`/inbox/${messaging.existing_thread_id}`} className="mirror-dual-actions__foot-link">
                查看既有對話 →
              </Link>
            </p>
          )}

          {photoExchange.reason === 'pending_outgoing' && (
            <p className="mirror-dual-actions__foot mirror-dual-actions__foot--muted" role="status">
              已發送交換邀請，等待 {label} 回傳相片…
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
