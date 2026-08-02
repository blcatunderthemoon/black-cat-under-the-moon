/**
 * Photo exchange status + actions on Mirror Card.
 */

import Link from 'next/link';
import { isPassportGatingDisabled, MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';
import { UiCameraIcon } from './UiIcons.js';

function OwnerPhotoPreview({ ownerPhoto, ownerName }) {
  if (!ownerPhoto) return null;

  if (ownerPhoto.mode === 'clear' && ownerPhoto.clear_url) {
    return (
      <div className="photo-exchange-panel__photo-wrap">
        <img
          src={ownerPhoto.clear_url}
          alt={`${ownerName || '對方'}的交換相片`}
          className="photo-exchange-panel__photo photo-exchange-panel__photo--clear"
          draggable={false}
        />
      </div>
    );
  }

  if (ownerPhoto.mode === 'blurred' && ownerPhoto.blurred_url) {
    return (
      <div className="photo-exchange-panel__photo-wrap photo-exchange-panel__photo-wrap--blur">
        <img
          src={ownerPhoto.blurred_url}
          alt=""
          aria-hidden="true"
          className="photo-exchange-panel__photo photo-exchange-panel__photo--blurred"
          draggable={false}
        />
        <div className="photo-exchange-panel__blur-overlay" aria-hidden="true" />
      </div>
    );
  }

  return null;
}

export default function PhotoExchangePanel({
  photoExchange,
  ownerName,
  busy,
  onRequest,
  onRespond,
  exchangePhotoHref = '/exchange-photo',
}) {
  if (!photoExchange) return null;

  const label = (ownerName || '對方').slice(0, 12);

  if (photoExchange.is_owner) {
    return (
      <div className="photo-exchange-panel photo-exchange-panel--owner">
        <h3 className="photo-exchange-panel__title">
          <span className="photo-exchange-panel__icon" aria-hidden="true"><UiCameraIcon size={16} /></span>
          交換相
        </h3>
        <p className="photo-exchange-panel__hint pixel-subtitle">
          {MOONLIGHT_PASSPORT_BRAND} 會員可向你發起真人相片交換。對方回傳時你才會被扣配額；成功後雙方可查看 7 日。
        </p>
        <Link
          href={exchangePhotoHref}
          className="mirror-letter-btn mirror-letter-btn--full photo-exchange-panel__btn"
        >
          {photoExchange.has_exchange_photo ? '管理交換用相片 →' : '上傳交換用相片 →'}
        </Link>
      </div>
    );
  }

  if (photoExchange.reason === 'blocked') {
    return (
      <div className="photo-exchange-panel">
        <p className="photo-exchange-panel__warn">無法與此用戶交換相片</p>
      </div>
    );
  }

  // Completed exchanges are viewed on /exchange-photo — no inline photo on Mirror Card.
  if (photoExchange.reason === 'exchange_active') {
    const viewHref = photoExchange.exchange_id
      ? `/exchange-photo?exchange=${encodeURIComponent(photoExchange.exchange_id)}`
      : null;
    if (!viewHref) return null;
    return (
      <div className="photo-exchange-panel photo-exchange-panel--view-link">
        <Link href={viewHref} className="mirror-letter-btn mirror-letter-btn--full photo-exchange-panel__btn">
          查看交換相片 →
        </Link>
      </div>
    );
  }

  const showPhoto = photoExchange.owner_photo
    && photoExchange.owner_photo.mode === 'blurred';

  return (
    <div className="photo-exchange-panel">
      <h3 className="photo-exchange-panel__title">
        <span className="photo-exchange-panel__icon" aria-hidden="true"><UiCameraIcon size={16} /></span>
        交換相
      </h3>

      {showPhoto && (
        <>
          <OwnerPhotoPreview ownerPhoto={photoExchange.owner_photo} ownerName={label} />
          <p className="photo-exchange-panel__hint pixel-subtitle">
            {label} 已附上相片預覽。回傳你的相片以解鎖清晰版本。
          </p>
        </>
      )}

      {photoExchange.can_respond && (
        <button
          type="button"
          className="mirror-letter-btn mirror-letter-btn--full photo-exchange-panel__btn"
          disabled={busy}
          onClick={onRespond}
        >
          上傳你的相片以解鎖
        </button>
      )}

      {photoExchange.can_request && (
        <>
          {typeof photoExchange.quota_remaining === 'number' && (
            <p className="photo-exchange-panel__quota">
              本月尚餘 {photoExchange.quota_remaining} / {photoExchange.quota_limit || 3} 次邀請
            </p>
          )}
          <button
            type="button"
            className="mirror-letter-btn mirror-letter-btn--full photo-exchange-panel__btn"
            disabled={busy}
            onClick={onRequest}
          >
            發起交換相
          </button>
        </>
      )}

      {photoExchange.reason === 'pending_outgoing' && (
        <div className="photo-exchange-panel__pending">
          <p className="photo-exchange-panel__hint pixel-subtitle">
            已發送交換邀請，等待 {label} 回傳相片…
          </p>
          <p className="photo-exchange-panel__sent mirror-letter-btn mirror-letter-btn--full photo-exchange-panel__btn" role="status">
            邀請已發送
          </p>
        </div>
      )}

      {photoExchange.reason === 'premium_required' && !photoExchange.can_respond && !isPassportGatingDisabled() && (
        <div className="photo-exchange-panel__upsell">
          <p className="photo-exchange-panel__hint pixel-subtitle">
            {MOONLIGHT_PASSPORT_BRAND} 可發起真人相片交換邀請（每月 3 次）
          </p>
          <Link href="/premium" className="mirror-letter-btn mirror-letter-btn--ghost">
            了解 {MOONLIGHT_PASSPORT_BRAND}
          </Link>
        </div>
      )}

      {photoExchange.reason === 'quota_exhausted' && !photoExchange.can_respond && (
        <p className="photo-exchange-panel__warn">
          本月交換相邀請額度已用完（每月 3 次）
        </p>
      )}

      {photoExchange.reason === 'photo_required'
        && !photoExchange.can_request
        && !photoExchange.can_respond && (
        <Link
          href={exchangePhotoHref}
          className="mirror-letter-btn mirror-letter-btn--full photo-exchange-panel__btn"
        >
          上傳交換用相片 →
        </Link>
      )}
    </div>
  );
}
