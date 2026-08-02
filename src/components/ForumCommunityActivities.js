/**
 * Compact「社群活動」discovery strip for Forum (Community Hub).
 * Collapsed by default; when open shows activity tiles + optional panels (children).
 */

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { getForumMoonlightGatheringTeaser } from '../lib/moonlight-gathering-001.js';
import {
  ForumMoonIcon,
  ForumTrophyIcon,
  ForumPawIcon,
  HeaderCalendarIcon,
} from './ForumIcons.js';

const STORAGE_KEY = 'bcutm_forum_community_activities_open';

function buildActivities() {
  const gathering = getForumMoonlightGatheringTeaser();
  // Mobile 2×2: top = 心願 / 簽到; bottom = 聚會 / 排行榜 (live / hub defaults)
  return [
    {
      id: 'wish',
      href: '/wishes',
      title: '月光心願',
      hint: '心願牆',
      Icon: ForumMoonIcon,
    },
    {
      id: 'checkin',
      href: '/my-cat',
      title: '每日簽到',
      hint: '餵養黑貓',
      Icon: ForumPawIcon,
    },
    {
      id: 'gathering',
      href: gathering.href,
      title: '月光聚會',
      hint: gathering.hint,
      Icon: HeaderCalendarIcon,
      featured: gathering.featured,
    },
    {
      id: 'rank',
      href: '#forum-hot',
      title: '排行榜',
      hint: '本週火種',
      Icon: ForumTrophyIcon,
      isRank: true,
    },
  ];
}

export function scrollForumHotPanelIntoView() {
  if (typeof document === 'undefined') return false;
  const panels = document.querySelectorAll('[data-forum-hot-panel]');
  const el = [...panels].find((node) => node.offsetParent !== null) || panels[0];
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el.classList.add('forum-panel--flash');
  window.setTimeout(() => el.classList.remove('forum-panel--flash'), 1200);
  return true;
}

export default function ForumCommunityActivities({
  onRankClick,
  onOpenChange,
  children = null,
} = {}) {
  const activities = buildActivities();
  const bodyId = useId();
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof onOpenChange === 'function') onOpenChange(open);
    // Sync once on mount (e.g. restored open from sessionStorage).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* private mode */
      }
      if (typeof onOpenChange === 'function') onOpenChange(next);
      return next;
    });
  }

  return (
    <section
      className={`forum-community-activities${open ? ' forum-community-activities--open' : ' forum-community-activities--collapsed'}`}
      aria-labelledby="forum-community-activities-title"
    >
      <div className="forum-community-activities__head">
        <button
          type="button"
          className="forum-community-activities__toggle"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
        >
          <h2 id="forum-community-activities-title" className="forum-community-activities__title">
            <ForumMoonIcon size={14} className="forum-community-activities__title-icon" />
            社群活動
            <span className="forum-community-activities__chevron-toggle" aria-hidden="true">
              {open ? '▾' : '▸'}
            </span>
          </h2>
          <p className="forum-community-activities__sub">一鍵去玩 · 圍爐以外嘅月光日常</p>
        </button>
      </div>
      <div
        id={bodyId}
        className="forum-community-activities__body"
        hidden={!open}
      >
        <ul className="forum-community-activities__grid">
          {activities.map(({ id, href, title, hint, Icon, isRank, featured }) => (
            <li key={id}>
              {isRank ? (
                <a
                  href={href}
                  className="forum-community-activities__tile forum-community-activities__tile--rank"
                  aria-label={`${title}：${hint}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (typeof onRankClick === 'function') onRankClick();
                    else scrollForumHotPanelIntoView();
                  }}
                >
                  <span className="forum-community-activities__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="forum-community-activities__copy">
                    <span className="forum-community-activities__name">{title}</span>
                    <span className="forum-community-activities__hint">{hint}</span>
                  </span>
                  <span className="forum-community-activities__chevron" aria-hidden="true">›</span>
                </a>
              ) : (
                <Link
                  href={href}
                  className={[
                    'forum-community-activities__tile',
                    `forum-community-activities__tile--${id}`,
                    featured ? 'forum-community-activities__tile--featured' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={`${title}：${hint}`}
                >
                  <span className="forum-community-activities__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="forum-community-activities__copy">
                    <span className="forum-community-activities__name">{title}</span>
                    <span className={`forum-community-activities__hint${featured ? ' forum-community-activities__hint--live' : ''}`}>
                      {hint}
                    </span>
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </section>
  );
}
