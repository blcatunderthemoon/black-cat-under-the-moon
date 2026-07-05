/**
 * Forum sidebar — Moon Journey progress + daily check-in.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PixelMoonIcon from './PixelMoonIcon.js';
import { MOON_JOURNEY_GUIDE_PATH } from '../lib/moon-journey.js';

function MoonJourneyPanelHead({ level }) {
  return (
    <Link href={MOON_JOURNEY_GUIDE_PATH} className="moon-journey-panel__head-link">
      <div className="moon-journey-panel__head-row">
        <h3 className="moon-journey-panel__title">月光旅程</h3>
        {level != null && (
          <span className="moon-journey-panel__lv-badge">Lv{level}</span>
        )}
      </div>
      <p className="moon-journey-panel__subtitle">Moon Journey · 玩法說明</p>
    </Link>
  );
}

function progressCopy(journey) {
  if (!journey || journey.is_max_level) return null;
  const nextLevel = journey.next_level ?? (journey.level < 7 ? journey.level + 1 : null);
  const expToNext = journey.exp_to_next ?? 0;
  if (!nextLevel) return null;
  return { nextLevel, expToNext };
}

export default function MoonJourneyPanel({
  accessToken,
  journey: journeyProp,
  compact = false,
  compactLayout = 'inline',
  onJourneyUpdate,
}) {
  const [localJourney, setLocalJourney] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const journey = journeyProp ?? localJourney;
  const journeyLoading = !!accessToken && !journey && loading;
  const viewJourney = journey;

  const applyJourney = useCallback((next) => {
    if (journeyProp == null) {
      setLocalJourney(next);
    }
    onJourneyUpdate?.(next);
  }, [journeyProp, onJourneyUpdate]);

  const loadJourney = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    if (journeyProp != null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/forum/moon-journey', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        const data = await r.json();
        applyJourney(data.moon_journey || null);
      }
    } catch {
      /* keep last state */
    } finally {
      setLoading(false);
    }
  }, [accessToken, applyJourney, journeyProp]);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    if (journeyProp != null) {
      setLoading(false);
      return;
    }
    if (!localJourney) {
      loadJourney();
    }
  }, [accessToken, journeyProp, localJourney, loadJourney]);

  useEffect(() => {
    if (!statusMsg) return undefined;
    const timer = setTimeout(() => setStatusMsg(''), 3200);
    return () => clearTimeout(timer);
  }, [statusMsg]);

  async function handleCheckIn() {
    if (!accessToken || checkingIn || journey?.checked_in_today) return;
    setCheckingIn(true);
    setStatusMsg('');
    try {
      const r = await fetch('/api/forum/moon-journey/check-in', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusMsg(data.error || '打卡失敗');
        return;
      }
      if (data.moon_journey) {
        applyJourney(data.moon_journey);
      } else {
        await loadJourney();
      }
      if (data.leveled_up) {
        setStatusMsg('升級了！月光又亮了一分 ✨');
      } else if (data.awarded) {
        setStatusMsg('+2 月光經驗');
      } else if (data.already_checked_in) {
        setStatusMsg('今日已打卡');
      }
    } catch {
      setStatusMsg('網路錯誤，請重試');
    } finally {
      setCheckingIn(false);
    }
  }

  if (compact && compactLayout === 'dropdown') {
    if (!accessToken) return null;

    const compactProgress = progressCopy(viewJourney);
    const compactProgressPct = viewJourney?.progress_pct ?? 0;

    return (
      <div className="moon-journey-dropdown-card">
        <div className="moon-journey-dropdown-card__main">
          <Link href={MOON_JOURNEY_GUIDE_PATH} className="moon-journey-dropdown-card__identity">
            <span className="moon-journey-dropdown-card__moon" aria-hidden="true">
              {journeyLoading ? '🌑' : (viewJourney?.emoji || '🌑')}
            </span>
            <span className="moon-journey-dropdown-card__meta">
              <span className="moon-journey-dropdown-card__level">
                {journeyLoading
                  ? '月光旅程'
                  : `Lv${viewJourney?.level ?? 1} ${viewJourney?.title_zh || '月下幼貓'}`}
              </span>
              <span className="moon-journey-dropdown-card__exp">
                {journeyLoading
                  ? '…'
                  : viewJourney?.is_max_level
                    ? `${viewJourney.exp} EXP · 滿級`
                    : `${viewJourney?.exp ?? 0} EXP · 差 ${compactProgress?.expToNext ?? '—'} 升級`}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className={`moon-journey-dropdown-card__checkin${viewJourney?.checked_in_today ? ' moon-journey-dropdown-card__checkin--done' : ''}`}
            onClick={handleCheckIn}
            disabled={checkingIn || viewJourney?.checked_in_today || journeyLoading}
            title={viewJourney?.checked_in_today ? '今日已打卡' : '今日打卡 +2 EXP'}
          >
            {checkingIn
              ? '…'
              : viewJourney?.checked_in_today
                ? '已打卡'
                : '+2 打卡'}
          </button>
        </div>
        {!viewJourney?.is_max_level && (
          <div
            className="moon-journey-dropdown-card__progress"
            role="progressbar"
            aria-valuenow={compactProgressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="升級進度"
          >
            <span
              className="moon-journey-dropdown-card__progress-fill"
              style={{ width: `${Math.max(compactProgressPct, viewJourney?.exp > 0 ? 6 : 0)}%` }}
            />
          </div>
        )}
        <Link href={MOON_JOURNEY_GUIDE_PATH} className="moon-journey-dropdown-card__guide">
          玩法說明
        </Link>
        {statusMsg && (
          <p className="moon-journey-dropdown-card__status" role="status">{statusMsg}</p>
        )}
      </div>
    );
  }

  if (compact) {
    if (!accessToken) {
      return (
        <aside className="forum-panel forum-panel--moon-journey moon-journey-panel moon-journey-panel--compact">
          <Link href={MOON_JOURNEY_GUIDE_PATH} className="moon-journey-panel__compact-info">
            <span className="moon-journey-panel__compact-emoji" aria-hidden="true">🌑</span>
            <span className="moon-journey-panel__compact-text">
              <span className="moon-journey-panel__compact-title">月光旅程</span>
              <span className="moon-journey-panel__compact-sub">登入參與、累積 EXP</span>
            </span>
          </Link>
          <Link href="/login?redirect=/forum" className="moon-journey-panel__compact-checkin moon-journey-panel__compact-checkin--link">
            登入
          </Link>
        </aside>
      );
    }

    const compactProgress = progressCopy(viewJourney);
    const compactProgressPct = viewJourney?.progress_pct ?? 0;

    return (
      <aside className="forum-panel forum-panel--moon-journey moon-journey-panel moon-journey-panel--compact">
        <Link href={MOON_JOURNEY_GUIDE_PATH} className="moon-journey-panel__compact-info">
          <span className="moon-journey-panel__compact-emoji" aria-hidden="true">
            {journeyLoading ? '🌑' : (viewJourney?.emoji || '🌑')}
          </span>
          <span className="moon-journey-panel__compact-text">
            <span className="moon-journey-panel__compact-title">
              Lv{viewJourney?.level ?? 1} {viewJourney?.title_zh || '月下幼貓'}
            </span>
            <span className="moon-journey-panel__compact-sub">
              {journeyLoading
                ? '…'
                : viewJourney?.is_max_level
                  ? `${viewJourney.exp} EXP · 滿級`
                  : `${viewJourney?.exp ?? 0} EXP · 差 ${compactProgress?.expToNext ?? '—'} 升級`}
            </span>
          </span>
          {!viewJourney?.is_max_level && (
            <span
              className="moon-journey-panel__compact-progress"
              role="progressbar"
              aria-valuenow={compactProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="升級進度"
            >
              <span
                className="moon-journey-panel__compact-progress-fill"
                style={{ width: `${Math.max(compactProgressPct, viewJourney?.exp > 0 ? 6 : 0)}%` }}
              />
            </span>
          )}
        </Link>
        <button
          type="button"
          className={`moon-journey-panel__compact-checkin${viewJourney?.checked_in_today ? ' moon-journey-panel__compact-checkin--done' : ''}`}
          onClick={handleCheckIn}
          disabled={checkingIn || viewJourney?.checked_in_today || journeyLoading}
          title={viewJourney?.checked_in_today ? '今日已打卡' : '今日打卡 +2 EXP'}
        >
          {checkingIn
            ? '…'
            : viewJourney?.checked_in_today
              ? '已打卡'
              : '+2 打卡'}
        </button>
        {statusMsg && (
          <p className="moon-journey-panel__compact-status" role="status">{statusMsg}</p>
        )}
      </aside>
    );
  }

  if (!accessToken) {
    return (
      <aside className="forum-panel forum-panel--moon-journey moon-journey-panel">
        <div className="moon-journey-panel__head">
          <MoonJourneyPanelHead />
        </div>
        <div className="moon-journey-panel__body moon-journey-panel__body--guest">
          <div className="moon-journey-panel__moon-orbit moon-journey-panel__moon-orbit--guest">
            <PixelMoonIcon size={32} />
          </div>
          <p className="moon-journey-panel__guest-text">
            每個人都是一隻黑貓，隨著參與社群逐漸成長。
          </p>
          <Link href="/login?redirect=/forum" className="moon-journey-panel__login-link">
            登入開始旅程
          </Link>
        </div>
      </aside>
    );
  }

  const progress = progressCopy(viewJourney);
  const progressPct = viewJourney?.progress_pct ?? 0;

  return (
    <aside className="forum-panel forum-panel--moon-journey moon-journey-panel">
      <div className="moon-journey-panel__head">
        <MoonJourneyPanelHead level={viewJourney?.level} />
      </div>

      <div className="moon-journey-panel__body">
        {journeyLoading ? (
          <p className="moon-journey-panel__loading">載入中…</p>
        ) : (
          <>
            <div className="moon-journey-panel__hero">
              <div className="moon-journey-panel__moon-orbit" aria-hidden="true">
                <span className="moon-journey-panel__emoji">{viewJourney?.emoji || '🌑'}</span>
              </div>
              <div className="moon-journey-panel__identity">
                <p className="moon-journey-panel__title-zh">{viewJourney?.title_zh || '月下幼貓'}</p>
                <p className="moon-journey-panel__title-en">{viewJourney?.title_en || 'Moon Kitten'}</p>
              </div>
            </div>

            <div className="moon-journey-panel__exp-block">
              <div className="moon-journey-panel__exp-row">
                <span className="moon-journey-panel__exp-value">
                  <span className="moon-journey-panel__exp-num">{viewJourney?.exp ?? 0}</span>
                  <span className="moon-journey-panel__exp-unit">EXP</span>
                </span>
                {progress && (
                  <span className="moon-journey-panel__exp-next">
                    還差 <strong>{progress.expToNext}</strong> → Lv{progress.nextLevel}
                  </span>
                )}
                {viewJourney?.is_max_level && (
                  <span className="moon-journey-panel__exp-max">滿級</span>
                )}
              </div>

              <div
                className="moon-journey-panel__progress"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="升級進度"
              >
                <div
                  className="moon-journey-panel__progress-fill"
                  style={{ width: `${Math.max(progressPct, viewJourney?.exp > 0 ? 4 : 0)}%` }}
                />
              </div>

              {!viewJourney?.is_max_level && progress && (
                <p className="moon-journey-panel__progress-hint">
                  升級進度 {progressPct}%
                </p>
              )}
            </div>

            {(viewJourney?.checkin_streak ?? 0) > 0 && (
              <p className="moon-journey-panel__streak">
                🔥 連續打卡 <strong>{viewJourney.checkin_streak}</strong> 天
              </p>
            )}

            <button
              type="button"
              className={`moon-journey-panel__checkin${viewJourney?.checked_in_today ? ' moon-journey-panel__checkin--done' : ''}`}
              onClick={handleCheckIn}
              disabled={checkingIn || viewJourney?.checked_in_today}
            >
              <span className="moon-journey-panel__checkin-icon" aria-hidden="true">
                {viewJourney?.checked_in_today ? '✓' : '🌙'}
              </span>
              <span className="moon-journey-panel__checkin-text">
                {checkingIn
                  ? '打卡中…'
                  : viewJourney?.checked_in_today
                    ? '今日已打卡'
                    : '今日打卡 +2 EXP'}
              </span>
            </button>

            {statusMsg && (
              <p className="moon-journey-panel__status" role="status">{statusMsg}</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

export function MoonJourneyAccountCard({ moonJourney, accessToken, onJourneyUpdate }) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!statusMsg) return undefined;
    const timer = setTimeout(() => setStatusMsg(''), 3200);
    return () => clearTimeout(timer);
  }, [statusMsg]);

  if (!moonJourney) return null;

  const progress = progressCopy(moonJourney);
  const progressPct = moonJourney.progress_pct ?? 0;

  async function handleCheckIn() {
    if (!accessToken || checkingIn || moonJourney?.checked_in_today) return;
    setCheckingIn(true);
    setStatusMsg('');
    try {
      const r = await fetch('/api/forum/moon-journey/check-in', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusMsg(data.error || '打卡失敗');
        return;
      }
      if (data.moon_journey) {
        onJourneyUpdate?.(data.moon_journey);
      } else {
        const refresh = await fetch('/api/forum/moon-journey', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (refresh.ok) {
          const refreshed = await refresh.json();
          onJourneyUpdate?.(refreshed.moon_journey || null);
        }
      }
      if (data.leveled_up) {
        setStatusMsg('升級了！月光又亮了一分 ✨');
      } else if (data.awarded) {
        setStatusMsg('+2 月光經驗');
      } else if (data.already_checked_in) {
        setStatusMsg('今日已打卡');
      }
    } catch {
      setStatusMsg('網路錯誤，請重試');
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <section className="pixel-card pixel-card--moon moon-journey-account">
      <div className="moon-journey-account__head">
        <h2 className="pixel-section-title moon-journey-account__title">
          <Link href={MOON_JOURNEY_GUIDE_PATH} className="moon-journey-account__title-link">
            // 月光旅程
          </Link>
        </h2>
        <span className="moon-journey-account__lv-badge">Lv{moonJourney.level}</span>
      </div>

      <div className="moon-journey-account__hero">
        <div className="moon-journey-account__moon-orbit" aria-hidden="true">
          <PixelMoonIcon size={44} />
        </div>
        <div className="moon-journey-account__identity">
          <p className="moon-journey-account__level">
            Lv{moonJourney.level} {moonJourney.title_zh}
          </p>
          <p className="moon-journey-account__level-en">{moonJourney.title_en}</p>
        </div>
      </div>

      <div className="moon-journey-account__stats">
        <div className="moon-journey-account__stat">
          <span className="moon-journey-account__stat-label">累積 EXP</span>
          <span className="moon-journey-account__stat-value">{moonJourney.exp}</span>
        </div>
        <div className="moon-journey-account__stat">
          <span className="moon-journey-account__stat-label">連續打卡</span>
          <span className="moon-journey-account__stat-value">{moonJourney.checkin_streak ?? 0} 天</span>
        </div>
      </div>

      {!moonJourney.is_max_level && (
        <div className="moon-journey-account__progress-wrap">
          <div
            className="moon-journey-account__progress"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="升級進度"
          >
            <div
              className="moon-journey-account__progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {progress && (
            <p className="moon-journey-account__next">
              距 Lv{progress.nextLevel}（{moonJourney.next_title_zh || moonJourney.next_title_en}）還差{' '}
              <strong>{progress.expToNext} EXP</strong>
            </p>
          )}
        </div>
      )}

      {moonJourney.is_max_level && (
        <p className="moon-journey-account__max">已達滿級 · 月光永駐</p>
      )}

      <div className="moon-journey-account__actions">
        <button
          type="button"
          className={`moon-journey-account__checkin${moonJourney.checked_in_today ? ' moon-journey-account__checkin--done' : ''}`}
          onClick={handleCheckIn}
          disabled={checkingIn || moonJourney.checked_in_today}
        >
          <span className="moon-journey-account__checkin-icon" aria-hidden="true">
            {moonJourney.checked_in_today ? '✓' : '🌙'}
          </span>
          {checkingIn
            ? '打卡中…'
            : moonJourney.checked_in_today
              ? '今日已打卡'
              : '每日打卡 +2 EXP'}
        </button>
        <Link href={MOON_JOURNEY_GUIDE_PATH} className="moon-journey-account__guide-link">
          玩法與升級 →
        </Link>
      </div>

      {statusMsg && (
        <p className="moon-journey-account__status" role="status">{statusMsg}</p>
      )}
    </section>
  );
}
