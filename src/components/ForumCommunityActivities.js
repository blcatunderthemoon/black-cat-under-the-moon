/**
 * Compact「社群活動」discovery strip for Forum (Community Hub).
 * Links only — no heavy fetch on first paint.
 */

import Link from 'next/link';
import {
  ForumMoonIcon,
  ForumTrophyIcon,
  ForumPawIcon,
  HeaderCalendarIcon,
} from './ForumIcons.js';

const ACTIVITIES = [
  {
    id: 'wish',
    href: '/wishes',
    title: '月光心願',
    hint: '心願牆',
    Icon: ForumMoonIcon,
  },
  {
    id: 'gathering',
    href: '/gatherings',
    title: '月光聚會',
    hint: '約人出沒',
    Icon: HeaderCalendarIcon,
  },
  {
    id: 'checkin',
    href: '/my-cat',
    title: '每日簽到',
    hint: '餵養黑貓',
    Icon: ForumPawIcon,
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

export default function ForumCommunityActivities({ onRankClick } = {}) {
  return (
    <section className="forum-community-activities" aria-labelledby="forum-community-activities-title">
      <div className="forum-community-activities__head">
        <h2 id="forum-community-activities-title" className="forum-community-activities__title">
          <ForumMoonIcon size={14} className="forum-community-activities__title-icon" />
          社群活動
        </h2>
        <p className="forum-community-activities__sub">一鍵去玩 · 圍爐以外嘅月光日常</p>
      </div>
      <ul className="forum-community-activities__grid">
        {ACTIVITIES.map(({ id, href, title, hint, Icon, isRank }) => (
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
                className={`forum-community-activities__tile forum-community-activities__tile--${id}`}
                aria-label={`${title}：${hint}`}
              >
                <span className="forum-community-activities__icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="forum-community-activities__copy">
                  <span className="forum-community-activities__name">{title}</span>
                  <span className="forum-community-activities__hint">{hint}</span>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
