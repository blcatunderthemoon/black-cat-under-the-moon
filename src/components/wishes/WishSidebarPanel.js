/**
 * Forum Moonlight Wishes widget — warm sidebar + quick cheer (no quest/KPI tone).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { daysLeftLabel } from '../../lib/wishes.js';
import { ForumMoonIcon, ForumSparkleIcon, ForumClockIcon, HeaderHeartIcon } from '../ForumIcons.js';

function phaseFromProgress(progress) {
  const p = Number(progress) || 0;
  if (p >= 100) return { phase: 'full', label: '印花將滿', bar: 100 };
  if (p >= 80) return { phase: 'gibbous', label: '慢慢蓋緊', bar: p };
  if (p >= 50) return { phase: 'half', label: '半途印花', bar: p };
  if (p > 0) return { phase: 'new', label: '開始蓋印', bar: Math.max(p, 8) };
  return { phase: 'new', label: '尚未蓋印', bar: 8 };
}

function MoonPhaseIcon({ phase, className = '' }) {
  return (
    <span
      className={`wish-moon__phase-ico wish-moon__phase-ico--${phase}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );
}

function WishQuestCard({
  wish,
  viewerId,
  busyId,
  burstId,
  onCheer,
}) {
  const left = daysLeftLabel(wish.target_at);
  const isOwn = viewerId && wish.user_id === viewerId;
  const phase = phaseFromProgress(wish.progress);
  const pct = Math.max(0, Math.min(100, Number(wish.progress) || 0));
  const displayBar = pct > 0 ? pct : phase.bar;

  return (
    <article
      className={`forum-wish-quest__card${burstId === wish.id ? ' is-burst' : ''}`}
      data-cat={wish.category || '其他'}
    >
      <div className="forum-wish-quest__card-top">
        <span className="forum-wish-quest__cat">{wish.category || '其他'}</span>
        <div className="forum-wish-quest__card-top-end">
          {left ? (
            <span className="forum-wish-quest__eta">
              <ForumClockIcon size={11} />
              {left}
            </span>
          ) : null}
          {!isOwn ? (
            <button
              type="button"
              className={`forum-wish-quest__cheer-btn forum-wish-quest__cheer-btn--top${wish.cheered_by_me ? ' is-cheered' : ''}`}
              onClick={() => onCheer(wish)}
              disabled={!!wish.cheered_by_me || busyId === wish.id}
              title={wish.cheered_by_me ? '已打氣' : '為他打氣'}
              aria-label={wish.cheered_by_me ? '已打氣' : '為他打氣'}
            >
              <ForumSparkleIcon size={11} />
              {wish.cheered_by_me ? '已打氣' : '打氣'}
            </button>
          ) : null}
        </div>
      </div>
      <Link href={`/wishes/${wish.id}`} className="forum-wish-quest__card-body">
        <span className="forum-wish-quest__card-title">{wish.title}</span>
        <span className="forum-wish-quest__phase">
          <MoonPhaseIcon phase={phase.phase} />
          {phase.label}
        </span>
        <span className="forum-wish-quest__bar" aria-hidden="true">
          <span className="forum-wish-quest__bar-fill" style={{ width: `${displayBar}%` }} />
        </span>
      </Link>
      <div className="forum-wish-quest__card-foot">
        <span className="forum-wish-quest__cheers">
          <HeaderHeartIcon size={12} />
          {wish.cheer_count || 0}
        </span>
        {isOwn ? (
          <span className="forum-wish-quest__own">你的心願</span>
        ) : null}
      </div>
    </article>
  );
}

function WishCtaRow() {
  return (
    <div className="forum-wish-quest__cta-row" role="group" aria-label="月光心願快捷">
      <Link href="/wishes" className="forum-wish-quest__back">
        <ForumMoonIcon size={12} />
        心願牆
      </Link>
      <Link href="/wishes/new" className="forum-wish-quest__btn forum-wish-quest__btn--primary">
        <ForumSparkleIcon size={12} />
        許下心願
      </Link>
    </div>
  );
}

const FOLD_STORAGE_KEY = 'forum-wish-panel-folded';

export default function WishSidebarPanel({ accessToken = null, viewerId = null, compact = false }) {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [burstId, setBurstId] = useState(null);
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    if (!compact || typeof window === 'undefined') return;
    try {
      setFolded(window.sessionStorage.getItem(FOLD_STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, [compact]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/wishes?status=active&sort=cheers&limit=${compact ? 1 : 5}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setWishes(data.wishes || []);
        }
      } catch {
        /* silent — sidebar is optional */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken, compact]);

  function toggleFolded() {
    setFolded((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(FOLD_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function quickCheer(wish) {
    if (!accessToken) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/wishes/${wish.id}`)}`;
      return;
    }
    if (viewerId && wish.user_id === viewerId) return;
    if (wish.cheered_by_me || busyId === wish.id) return;
    setBusyId(wish.id);
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
        setWishes((prev) => prev.map((w) => (
          w.id === wish.id
            ? {
              ...w,
              cheer_count: data.wish?.cheer_count ?? (w.cheer_count || 0) + 1,
              cheered_by_me: true,
            }
            : w
        )));
        setBurstId(wish.id);
        window.setTimeout(() => setBurstId((id) => (id === wish.id ? null : id)), 650);
      }
    } finally {
      setBusyId(null);
    }
  }

  const list = compact ? wishes.slice(0, 1) : wishes;
  const bodyId = 'forum-wish-quest-body';
  const isFolded = compact && folded;

  return (
    <aside
      className={`forum-panel forum-panel--wishes${compact ? ' forum-panel--wishes-compact' : ' forum-panel--wishes-quest'}${isFolded ? ' is-folded' : ''}`}
    >
      <div className={`forum-wish-quest${compact ? ' forum-wish-quest--compact' : ''}`}>
        {compact ? (
          <button
            type="button"
            className="forum-wish-quest__banner forum-wish-quest__banner--centered forum-wish-quest__banner--toggle"
            aria-expanded={!isFolded}
            aria-controls={bodyId}
            onClick={toggleFolded}
          >
            <div className="forum-wish-quest__banner-copy">
              <h3 className="forum-wish-quest__title">
                <ForumMoonIcon size={16} />
                月光心願
              </h3>
            </div>
            <span className="forum-wish-quest__chevron" aria-hidden="true" />
          </button>
        ) : (
          <div className="forum-wish-quest__banner forum-wish-quest__banner--centered">
            <div className="forum-wish-quest__banner-copy">
              <h3 className="forum-wish-quest__title">
                <ForumMoonIcon size={16} />
                月光心願
              </h3>
            </div>
          </div>
        )}

        <div
          id={compact ? bodyId : undefined}
          className={`forum-wish-quest__body${isFolded ? ' is-collapsed' : ''}`}
          hidden={isFolded || undefined}
        >
          {loading ? (
            <p className="forum-wish-quest__loading" aria-busy="true">載入中…</p>
          ) : list.length === 0 ? (
            <div className="forum-wish-quest__empty">
              <MoonPhaseIcon phase="new" className="forum-wish-quest__empty-moon" />
              <p>暫時未有進行中的心願</p>
            </div>
          ) : (
            <ul className="forum-wish-quest__list">
              {list.map((w) => (
                <li key={w.id}>
                  <WishQuestCard
                    wish={w}
                    viewerId={viewerId}
                    busyId={busyId}
                    burstId={burstId}
                    onCheer={quickCheer}
                  />
                </li>
              ))}
            </ul>
          )}

          <WishCtaRow />
        </div>
      </div>
    </aside>
  );
}
