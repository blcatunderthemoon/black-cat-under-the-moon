/**
 * /wishes/[id] — wish detail (low-pressure, campfire feel)
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead.js';
import WishShell from '../../components/wishes/WishShell.js';
import { ForumSparkleIcon, ForumMoonIcon, ForumClockIcon, ForumPawIcon } from '../../components/ForumIcons.js';
import { UiFlagIcon } from '../../components/UiIcons.js';
import WishShareButton from '../../components/wishes/WishShareButton.js';
import { useAuth } from '../../lib/auth-context.js';
import { mirrorCardHref } from '../../lib/profile-links.js';
import {
  daysLeftLabel,
  formatWishCheckinLabel,
} from '../../lib/wishes.js';

const STATUS_LABEL = {
  active: '進行中',
  completed: '已完成',
  abandoned: '已放棄',
  expired: '已過期',
  hidden: '已隱藏',
};

export default function WishDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { session, loading: authLoading } = useAuth();
  const [wish, setWish] = useState(null);
  const [cheers, setCheers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState(''); // 'success' | 'muted' | ''
  const [completionNote, setCompletionNote] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const [stampBurst, setStampBurst] = useState(null);
  const [checkinDays, setCheckinDays] = useState([]);
  const [stampedSet, setStampedSet] = useState(() => new Set());
  const [checkinToday, setCheckinToday] = useState('');

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/wishes/${encodeURIComponent(id)}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '載入失敗');
        setWish(null);
        return;
      }
      setWish(data.wish);
      setCheers(data.cheers || []);
      setIsOwner(!!data.is_owner);
      const cin = data.checkins || {};
      setCheckinDays(cin.days || []);
      setCheckinToday(cin.today || '');
      setStampedSet(new Set(cin.stamped || []));
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [id, session?.access_token]);

  function flashToast(message, tone = '') {
    setToast(message);
    setToastTone(tone);
  }

  useEffect(() => {
    if (!router.isReady || authLoading) return;
    load();
  }, [router.isReady, authLoading, load]);

  async function authFetch(path, options = {}) {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/wishes/${id}`)}`);
      return null;
    }
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function handleCheer() {
    if (wish?.cheered_by_me || busy) return;
    setBusy('cheer');
    flashToast('');
    try {
      const result = await authFetch(`/api/wishes/${encodeURIComponent(id)}/cheer`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!result) return;
      if (!result.res.ok) {
        flashToast(result.data.error || '打氣失敗');
        return;
      }
      setWish(result.data.wish);
      await load();
      flashToast('已送出打氣');
    } finally {
      setBusy('');
    }
  }

  async function handleCheckin(day) {
    if (!isOwner || busy) return;
    if (day !== checkinToday) {
      flashToast('而家只可以蓋今日嘅印花——唔使補舊帳。');
      return;
    }
    setBusy('checkin');
    flashToast('');
    setStampBurst(day);
    window.setTimeout(() => setStampBurst((d) => (d === day ? null : d)), 700);
    try {
      const result = await authFetch(`/api/wishes/${encodeURIComponent(id)}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ day }),
      });
      if (!result) return;
      if (!result.res.ok) {
        flashToast(result.data.error || '打卡失敗，請再試一次');
        return;
      }
      setWish(result.data.wish);
      setStampedSet(new Set(result.data.stamped_days || []));
      if (result.data.stamped) {
        flashToast('打卡成功 · 今日印花已蓋好', 'success');
      } else {
        flashToast('已取消今日打卡', 'muted');
      }
    } finally {
      setBusy('');
    }
  }

  async function handleComplete() {
    setBusy('complete');
    flashToast('');
    try {
      const result = await authFetch(`/api/wishes/${encodeURIComponent(id)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ completion_note: completionNote || null }),
      });
      if (!result) return;
      if (!result.res.ok) {
        flashToast(result.data.error || '完成失敗');
        return;
      }
      setWish(result.data.wish);
      setShowComplete(false);
      const shards = result.data.shards_gained || 0;
      flashToast(
        shards > 0
          ? `完成！獲得 +${shards} 月光碎屑`
          : (result.data.message || '心願已完成'),
        'success',
      );
    } finally {
      setBusy('');
    }
  }

  async function handleAbandon() {
    setBusy('abandon');
    try {
      const result = await authFetch(`/api/wishes/${encodeURIComponent(id)}/abandon`, {
        method: 'POST',
        body: '{}',
      });
      if (!result) return;
      if (!result.res.ok) {
        flashToast(result.data.error || '放棄失敗');
        return;
      }
      setWish(result.data.wish);
      setShowAbandon(false);
      flashToast('已輕輕放下呢個心願', 'muted');
    } finally {
      setBusy('');
    }
  }

  async function handleReport() {
    const reason = window.prompt('舉報原因（選填）') ?? '';
    if (reason === null) return;
    setBusy('report');
    try {
      const result = await authFetch(`/api/wishes/${encodeURIComponent(id)}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!result) return;
      flashToast(result.data.already_reported ? '你已舉報過' : (result.data.error || '已收到舉報，謝謝'));
    } finally {
      setBusy('');
    }
  }

  const left = daysLeftLabel(wish?.target_at);
  const canCheer = session && wish?.status === 'active' && !isOwner;
  const ownerActive = isOwner && ['active', 'expired'].includes(wish?.status);
  const stampedCount = stampedSet.size;
  const totalDays = checkinDays.length || 1;
  const stampsReady = stampedCount >= totalDays;
  const todayStamped = checkinToday ? stampedSet.has(checkinToday) : false;
  const ownerName = wish?.owner?.display_name || '匿名貓咪';
  const ownerProfileHref = wish
    ? mirrorCardHref({
      isMine: !!(session?.user?.id && wish.user_id === session.user.id),
      slug: wish.owner?.public_slug,
    })
    : null;

  return (
    <>
      <SeoHead
        title={wish?.title ? `${wish.title} · 月光心願` : '月光心願'}
        description={wish?.body || '月光心願詳情'}
        path={id ? `/wishes/${id}` : '/wishes'}
      />
      <WishShell
        title="心願詳情"
        redirectPath={id ? `/wishes/${id}` : '/wishes'}
        backHref="/wishes"
        backLabel="心願牆"
      >
        {loading && <p className="wishes-status">載入中…</p>}
        {!loading && error && <p className="wishes-error">{error}</p>}
        {!loading && wish && (
          <article className="wish-detail">
            <h1 className="wish-detail__title">{wish.title}</h1>

            <div className="wish-detail__meta">
              <span className="wish-detail__chip wish-detail__chip--cat" data-cat={wish.category}>
                {wish.category}
              </span>
              {left && (
                <span className="wish-detail__chip wish-detail__chip--time">
                  <ForumClockIcon size={11} /> {left}
                </span>
              )}
              {wish.status !== 'active' && (
                <span className="wish-detail__chip wish-detail__chip--status">
                  {STATUS_LABEL[wish.status] || wish.status}
                </span>
              )}
            </div>

            <p className="wish-detail__owner">
              {ownerProfileHref ? (
                <Link href={ownerProfileHref} className="wish-detail__owner-name wish-detail__owner-name--link">
                  {ownerName}
                </Link>
              ) : (
                <span className="wish-detail__owner-name">{ownerName}</span>
              )}
              <span className="wish-detail__owner-sep" aria-hidden="true">·</span>
              <span className="wish-detail__cheers">
                <ForumMoonIcon size={13} />
                <span>{wish.cheer_count || 0} 打氣</span>
              </span>
            </p>

            {wish.body && <p className="wish-detail__body">{wish.body}</p>}
            {wish.completion_note && (
              <p className="wish-detail__body wish-detail__body--note">
                完成感言：{wish.completion_note}
              </p>
            )}

            <section className="wish-moon wish-moon--stamps" aria-label="每日月光印花">
              <div className="wish-moon__header">
                <strong className="wish-moon__title">每日印花</strong>
                <span className="wish-moon__stamp-count">
                  已蓋 {stampedCount}／{totalDays} 日
                </span>
              </div>

              <div
                className="wish-moon__stamp-grid wish-moon__stamp-grid--days"
                role="group"
                aria-label="每日印花"
              >
                {checkinDays.map((day) => {
                  const stamped = stampedSet.has(day);
                  const isToday = day === checkinToday;
                  const isFuture = checkinToday && day > checkinToday;
                  const canStamp = ownerActive && isToday;
                  const Tag = canStamp ? 'button' : 'div';
                  return (
                    <Tag
                      key={day}
                      type={canStamp ? 'button' : undefined}
                      aria-label={`${formatWishCheckinLabel(day)}${stamped ? ' 已蓋印' : isToday ? ' 今日可蓋印' : ''}`}
                      aria-pressed={canStamp ? stamped : undefined}
                      className={[
                        'wish-moon__stamp',
                        stamped ? ' is-stamped' : '',
                        isToday ? ' is-today' : '',
                        isFuture ? ' is-future' : '',
                        stampBurst === day ? ' is-burst' : '',
                      ].join('')}
                      disabled={canStamp ? !!busy : undefined}
                      onClick={canStamp ? () => handleCheckin(day) : undefined}
                    >
                      <span className="wish-moon__stamp-pad">
                        <ForumPawIcon
                          size={stamped ? 18 : 16}
                          className={`wish-moon__stamp-paw${stamped ? ' is-inked' : ''}`}
                        />
                      </span>
                      <span className="wish-moon__stamp-label">
                        {isToday ? '今日' : formatWishCheckinLabel(day)}
                      </span>
                    </Tag>
                  );
                })}
              </div>

              <p className="wish-moon__stamp-hint">
                {stampsReady
                  ? '印花日子已蓋滿——可以標記完成啦。'
                  : todayStamped
                    ? '今日已蓋印，聽日再嚟吖。'
                    : ownerActive
                      ? '點「今日」蓋一印就得。'
                      : '慢慢嚟就好。'}
              </p>
            </section>

            {toast && (
              <p
                className={`wish-complete-toast wish-complete-toast--under-cal${toastTone ? ` wish-complete-toast--${toastTone}` : ''}`}
                role="status"
              >
                {toastTone === 'success' ? (
                  <span className="wish-complete-toast__badge" aria-hidden="true">
                    <ForumSparkleIcon size={14} />
                  </span>
                ) : null}
                <span className="wish-complete-toast__msg">{toast}</span>
              </p>
            )}

            <div className="wish-detail__actions">
              {canCheer && (
                <button
                  type="button"
                  className={`wishes-btn wishes-btn--primary wish-detail__cheer-cta${wish.cheered_by_me ? ' is-cheered' : ''}`}
                  disabled={!!busy || !!wish.cheered_by_me}
                  onClick={handleCheer}
                >
                  <ForumSparkleIcon size={14} />
                  {wish.cheered_by_me ? '已打氣' : '為她打氣'}
                </button>
              )}
              {!session && wish.status === 'active' && (
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/wishes/${id}`)}`}
                  className="wishes-btn wishes-btn--primary wish-detail__cheer-cta"
                >
                  <ForumSparkleIcon size={14} />
                  登入後為她打氣
                </Link>
              )}

              {ownerActive && (
                <div className="wish-detail__owner-actions">
                  <button
                    type="button"
                    className={`wish-detail__action-btn wish-detail__complete-cta${stampsReady ? ' is-ready' : ' is-soft'}`}
                    disabled={!!busy}
                    onClick={() => setShowComplete(true)}
                  >
                    <ForumPawIcon size={16} />
                    <span className="wish-detail__complete-cta-copy">
                      <span className="wish-detail__complete-cta-title">標記完成</span>
                      <span className="wish-detail__complete-cta-sub">
                        {stampsReady ? '+3 月光碎屑' : '印花未齊也可完成'}
                      </span>
                    </span>
                  </button>
                  <WishShareButton
                    title={wish.title}
                    path={`/wishes/${id}`}
                    onMessage={flashToast}
                  />
                  {!showAbandon ? (
                    <button
                      type="button"
                      className="wish-detail__action-btn wish-detail__abandon-btn"
                      onClick={() => setShowAbandon(true)}
                    >
                      放棄心願
                    </button>
                  ) : (
                    <div className="wish-detail__abandon-confirm">
                      <span>確定輕輕放下？唔會獲得碎屑。</span>
                      <button
                        type="button"
                        className="wish-detail__text-link wish-detail__text-link--danger"
                        disabled={!!busy}
                        onClick={handleAbandon}
                      >
                        確認放棄
                      </button>
                      <button
                        type="button"
                        className="wish-detail__text-link"
                        onClick={() => setShowAbandon(false)}
                      >
                        再諗諗
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!ownerActive && (
                <div className="wish-detail__secondary-actions">
                  <WishShareButton
                    title={wish.title}
                    path={`/wishes/${id}`}
                    onMessage={flashToast}
                  />
                  {session && !isOwner && (
                    <button
                      type="button"
                      className="wish-detail__action-btn wish-detail__report-btn"
                      disabled={!!busy}
                      onClick={handleReport}
                    >
                      <UiFlagIcon size={14} />
                      舉報
                    </button>
                  )}
                </div>
              )}
            </div>

            {showComplete && (
              <div className="wish-form wish-form--complete">
                <label>
                  完成感言（選填）
                  <textarea
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value.slice(0, 200))}
                    placeholder="想同打氣過嘅人講一句？"
                    maxLength={200}
                  />
                </label>
                <p className="wish-form__hint">設立滿 24 小時後可標記完成，每次完成可獲 +3 月光碎屑。</p>
                <div className="wish-form__actions">
                  <button
                    type="button"
                    className="wishes-btn wishes-btn--primary"
                    disabled={!!busy}
                    onClick={handleComplete}
                  >
                    確認完成
                  </button>
                  <button
                    type="button"
                    className="wishes-btn wishes-btn--ghost"
                    onClick={() => setShowComplete(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <section className="wish-cheers">
              <h2 className="wish-cheers__title">最近打氣</h2>
              {cheers.length === 0 ? (
                <div className="wish-cheers__empty">
                  <p>
                    {isOwner
                      ? '暫時未有打氣。完成進度或分享心願牆連結，等同類為你加油。'
                      : '還沒有人打氣，來做第一個？'}
                  </p>
                  {canCheer && !wish.cheered_by_me && (
                    <button
                      type="button"
                      className="wishes-btn wishes-btn--primary"
                      disabled={!!busy}
                      onClick={handleCheer}
                    >
                      <ForumSparkleIcon size={14} />
                      為她打氣
                    </button>
                  )}
                </div>
              ) : (
                <ul className="wish-cheers__list">
                  {cheers.map((c) => {
                    if (!isOwner || c.anonymous || !c.user) {
                      return (
                        <li key={c.id} className="wish-cheers__item">
                          <span className="wish-cheers__bubble" aria-hidden="true">
                            <ForumSparkleIcon size={12} />
                          </span>
                          <div className="wish-cheers__content">
                            <span className="wish-cheers__name">有人</span>
                            <span className="wish-cheers__note">送上溫柔打氣</span>
                          </div>
                        </li>
                      );
                    }
                    const cheerName = c.user.display_name || '匿名貓咪';
                    const cheerHref = mirrorCardHref({
                      isMine: !!(session?.user?.id && c.user.id === session.user.id),
                      slug: c.user.public_slug,
                    });
                    return (
                      <li key={c.id} className="wish-cheers__item">
                        <span className="wish-cheers__bubble" aria-hidden="true">
                          <ForumSparkleIcon size={12} />
                        </span>
                        <div className="wish-cheers__content">
                          {cheerHref ? (
                            <Link href={cheerHref} className="wish-cheers__name wish-cheers__name--link">
                              {cheerName}
                            </Link>
                          ) : (
                            <span className="wish-cheers__name">{cheerName}</span>
                          )}
                          {c.note
                            ? <span className="wish-cheers__note">{c.note}</span>
                            : <span className="wish-cheers__note">為你送上溫柔打氣</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </article>
        )}
      </WishShell>
    </>
  );
}
