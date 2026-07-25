import Link from 'next/link';
import { useEffect, useState } from 'react';
import { daysLeftLabel } from '../../lib/wishes.js';
import { mirrorCardHref } from '../../lib/profile-links.js';
import { ForumSparkleIcon, ForumClockIcon, HeaderHeartIcon } from '../ForumIcons.js';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return '剛才';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 日前`;
}

export default function WishCard({
  wish,
  href,
  accessToken = null,
  viewerId = null,
  onCheered,
}) {
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const [localCheered, setLocalCheered] = useState(!!wish?.cheered_by_me);
  const [localCount, setLocalCount] = useState(wish?.cheer_count || 0);

  useEffect(() => {
    setLocalCheered(!!wish?.cheered_by_me);
    setLocalCount(wish?.cheer_count || 0);
  }, [wish?.id, wish?.cheered_by_me, wish?.cheer_count]);

  if (!wish) return null;

  const link = href || `/wishes/${wish.id}`;
  const ownerName = wish.owner?.display_name || '匿名貓咪';
  const ownerProfileHref = mirrorCardHref({
    isMine: !!(viewerId && wish.user_id === viewerId),
    slug: wish.owner?.public_slug,
  });
  const left = daysLeftLabel(wish.target_at);
  const isOwn = viewerId && wish.user_id === viewerId;
  const cheered = localCheered;
  const canCheer = !isOwn && wish.status !== 'abandoned' && wish.status !== 'hidden';

  async function handleCheer(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!accessToken) {
      window.location.href = `/login?redirect=${encodeURIComponent(link)}`;
      return;
    }
    if (busy || isOwn || cheered) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/wishes/${wish.id}/cheer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextCount = data.wish?.cheer_count ?? localCount + 1;
        setLocalCheered(true);
        setLocalCount(nextCount);
        setBurst(true);
        window.setTimeout(() => setBurst(false), 700);
        onCheered?.(wish.id, {
          ...wish,
          cheer_count: nextCount,
          cheered_by_me: true,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`wish-card${burst ? ' wish-card--burst' : ''}`} data-category={wish.category || '其他'}>
      <Link href={link} className="wish-card__main">
        <div className="wish-card__top">
          <span className="wish-card__category">{wish.category || '其他'}</span>
          {left && (
            <span className="wish-card__eta" title="目標日子（低壓提醒）">
              <span className="wish-card__eta-ico" aria-hidden="true">
                <ForumClockIcon size={11} />
              </span>
              <span className="wish-card__eta-text">{left}</span>
            </span>
          )}
        </div>
        <h3 className="wish-card__title">「{wish.title}」</h3>
        {wish.body ? <p className="wish-card__excerpt">{wish.body}</p> : null}
      </Link>
      <div className="wish-card__footer">
        <p className="wish-card__owner">
          {ownerProfileHref ? (
            <Link href={ownerProfileHref} className="wish-card__owner-link">
              {ownerName}
            </Link>
          ) : (
            <span>{ownerName}</span>
          )}
          {wish.created_at ? ` · ${timeAgo(wish.created_at)}` : ''}
        </p>
        {canCheer ? (
          <button
            type="button"
            className={`wish-card__cheer-btn${cheered ? ' is-cheered' : ''}`}
            onClick={handleCheer}
            disabled={busy || cheered}
            aria-label={cheered ? '已打氣' : '為她打氣'}
            title={cheered ? '已打氣' : '為她打氣'}
          >
            <span className="wish-card__cheer-emoji" aria-hidden="true">
              {cheered ? <HeaderHeartIcon size={12} /> : <ForumSparkleIcon size={12} />}
            </span>
            <span className="wish-card__cheer-label">{cheered ? '已打氣' : '打氣'}</span>
            <span
              className="wish-card__cheer-count"
              data-digits={String(localCount).length >= 2 ? '2' : '1'}
            >
              {localCount}
            </span>
          </button>
        ) : (
          <span className="wish-card__cheers">
            <span className="wish-card__cheers-ico" aria-hidden="true">
              <HeaderHeartIcon size={12} />
            </span>
            <span>{localCount}</span>
          </span>
        )}
      </div>
      {burst && <span className="wish-card__sparkles" aria-hidden="true" />}
    </article>
  );
}
