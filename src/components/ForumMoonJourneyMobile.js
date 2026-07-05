/**
 * Mobile forum — Moon Journey toggle in header bar + dropdown panel + daily nudge.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import MoonJourneyPanel from './MoonJourneyPanel.js';
import { getHongKongDateString } from '../lib/moon-journey.js';

const NUDGE_MS = 4500;
const NUDGE_STORAGE_PREFIX = 'forum_mj_nudge_';

function nudgeStorageKey(userId) {
  return `${NUDGE_STORAGE_PREFIX}${userId}_${getHongKongDateString()}`;
}

export default function ForumMoonJourneyMobile({
  accessToken,
  userId,
  journey,
  onJourneyUpdate,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!userId || !journey || journey.checked_in_today) return undefined;
    try {
      const key = nudgeStorageKey(userId);
      if (localStorage.getItem(key)) return undefined;
      localStorage.setItem(key, '1');
    } catch {
      return undefined;
    }
    setShowNudge(true);
    const timer = setTimeout(() => setShowNudge(false), NUDGE_MS);
    return () => clearTimeout(timer);
  }, [userId, journey]);

  useEffect(() => {
    if (!expanded) return undefined;
    function onPointerDown(e) {
      if (rootRef.current?.contains(e.target)) return;
      setExpanded(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

  const handleJourneyUpdate = useCallback((next) => {
    onJourneyUpdate?.(next);
    if (next?.checked_in_today) setShowNudge(false);
  }, [onJourneyUpdate]);

  const openPanel = useCallback(() => {
    setExpanded(true);
    setShowNudge(false);
  }, []);

  if (!accessToken) return null;

  const pendingCheckIn = journey && !journey.checked_in_today;

  return (
    <span className="forum-mj-header-wrap" ref={rootRef}>
      <button
        type="button"
        className={`forum-mj-header-btn app-header__nav-link app-header__nav-link--icon${expanded ? ' forum-mj-header-btn--open' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="forum-mj-dropdown"
        title="月光旅程"
      >
        <span className="app-header__nav-icon forum-mj-header-btn__icon" aria-hidden="true">🌙</span>
        {pendingCheckIn && (
          <span className="forum-mj-header-btn__dot" aria-label="今日尚未打卡" />
        )}
      </button>

      {expanded && (
        <div id="forum-mj-dropdown" className="forum-mj-dropdown" role="dialog" aria-label="月光旅程">
          <MoonJourneyPanel
            accessToken={accessToken}
            journey={journey}
            compact
            compactLayout="dropdown"
            onJourneyUpdate={handleJourneyUpdate}
          />
        </div>
      )}

      {showNudge && (
        <button
          type="button"
          className="forum-mj-mobile-nudge"
          onClick={openPanel}
          aria-live="polite"
        >
          <span className="forum-mj-mobile-nudge__moon" aria-hidden="true">🌙</span>
          <span className="forum-mj-mobile-nudge__copy">
            <strong>今日還未打卡</strong>
            <span>+2 EXP · 點此打開</span>
          </span>
        </button>
      )}
    </span>
  );
}
