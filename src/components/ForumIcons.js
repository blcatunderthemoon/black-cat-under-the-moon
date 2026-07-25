/**
 * Forum stroke icons — same style as HeaderNavIcons (currentColor, 1.75).
 */

import {
  HeaderHeartIcon,
  HeaderChatIcon,
  HeaderCalendarIcon,
  HeaderShieldIcon,
  HeaderBookmarkIcon,
  HeaderForumIcon,
  HeaderUserPlusIcon,
  HeaderMailIcon,
} from './HeaderNavIcons.js';

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  'aria-hidden': true,
};

function Icon({ children, className = '', size = 14, ...rest }) {
  return (
    <svg
      {...BASE}
      className={className ? `header-nav-icon ${className}` : 'header-nav-icon'}
      width={size}
      height={size}
      {...rest}
    >
      {children}
    </svg>
  );
}

const S = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function ForumFlameIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 20c3.6 0 5.8-2.2 5.8-5.4 0-2.6-1.5-4.2-3-5.7-.4 2.1-1.5 3-2.8 3.2 0-3.2-1.5-5.6-4.2-7.6 0 2.8-.6 4.7-2 6.2C4.4 12.5 4 14.2 4 15.8 4 18.4 6.4 20 12 20z" {...S} />
    </Icon>
  );
}

export function ForumClockIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="8.25" {...S} />
      <path d="M12 8v4.5l3 2" {...S} />
    </Icon>
  );
}

export function ForumPawIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <ellipse cx="12" cy="15.2" rx="4.2" ry="3.4" {...S} />
      <circle cx="7.2" cy="10.2" r="1.7" {...S} />
      <circle cx="10.2" cy="8.2" r="1.7" {...S} />
      <circle cx="13.8" cy="8.2" r="1.7" {...S} />
      <circle cx="16.8" cy="10.2" r="1.7" {...S} />
    </Icon>
  );
}

export function ForumPinIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M9 4.5h6l-.8 5.2 2.3 2.3v1.5H7.5v-1.5l2.3-2.3L9 4.5z" {...S} />
      <path d="M12 13.5V19.5" {...S} />
    </Icon>
  );
}

export function ForumSparkleIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 3.5 13.4 9.2 19 10.5 13.4 11.8 12 17.5 10.6 11.8 5 10.5 10.6 9.2 12 3.5z" {...S} />
    </Icon>
  );
}

export function ForumMegaphoneIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M4.5 11.5v3.2c0 .7.5 1.3 1.2 1.3H7l1.4 3.2h2.1l-1.2-3.2H14.5" {...S} />
      <path d="M7 9.5 18.5 5.5v11L7 12.5v-3z" {...S} />
    </Icon>
  );
}

export function ForumFilmIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="4.5" y="6" width="15" height="12" rx="1.5" {...S} />
      <path d="M8 6v12M16 6v12M4.5 10H8M4.5 14H8M16 10h3.5M16 14h3.5" {...S} />
    </Icon>
  );
}

export function ForumCrystalIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 3.5 17.5 9.5 12 20.5 6.5 9.5 12 3.5z" {...S} />
      <path d="M6.5 9.5h11" {...S} />
    </Icon>
  );
}

export function ForumGamepadIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M6.5 9.5h11a3 3 0 0 1 0 6H14l-1.2 1.8h-1.6L10 15.5H6.5a3 3 0 0 1 0-6z" {...S} />
      <path d="M8.2 12.5h2.2M9.3 11.4v2.2" {...S} />
      <circle cx="15.2" cy="11.8" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="16.8" cy="13.2" r="0.7" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ForumBookIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M5.5 5.5h5.2c1.2 0 2.3.6 2.3 2v11c0-1.2-1.1-1.8-2.3-1.8H5.5v-11.2z" {...S} />
      <path d="M18.5 5.5h-5.2c-1.2 0-2.3.6-2.3 2v11c0-1.2 1.1-1.8 2.3-1.8h5.2V5.5z" {...S} />
    </Icon>
  );
}

export function ForumBlossomIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="2.2" {...S} />
      <path d="M12 4.5c1.4 2.2 1.4 4.2 0 5.5-1.4-1.3-1.4-3.3 0-5.5zM12 14c1.4 1.3 1.4 3.3 0 5.5-1.4-2.2-1.4-4.2 0-5.5zM4.5 12c2.2-1.4 4.2-1.4 5.5 0-1.3 1.4-3.3 1.4-5.5 0zM14 12c1.3-1.4 3.3-1.4 5.5 0-2.2 1.4-4.2 1.4-5.5 0z" {...S} />
    </Icon>
  );
}

export function ForumMoonIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M15.2 4.8A7.8 7.8 0 1 0 19.2 15 6.2 6.2 0 0 1 15.2 4.8z" {...S} />
    </Icon>
  );
}

/** Intimacy / 親密話題 — interlocking rings (not moon; moon is Moon Journey / Passport). */
export function ForumIntimateIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="9" cy="12" r="4.6" {...S} />
      <circle cx="15" cy="12" r="4.6" {...S} />
    </Icon>
  );
}

export function ForumLockIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="6.5" y="11" width="11" height="8.5" rx="1.5" {...S} />
      <path d="M9 11V8.5a3 3 0 0 1 6 0V11" {...S} />
    </Icon>
  );
}

export function ForumEyeIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6S2.5 12 2.5 12z" {...S} />
      <circle cx="12" cy="12" r="2.4" {...S} />
    </Icon>
  );
}

export function ForumSearchIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="10.5" cy="10.5" r="5.5" {...S} />
      <path d="M15 15l4 4" {...S} />
    </Icon>
  );
}

export function ForumScrollIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M7 5.5h10v13H7z" {...S} />
      <path d="M9.5 9h5M9.5 12h5M9.5 15h3.5" {...S} />
    </Icon>
  );
}

export function ForumRainbowIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M5 16.5a7 7 0 0 1 14 0" {...S} />
      <path d="M7.2 16.5a4.8 4.8 0 0 1 9.6 0" {...S} />
      <path d="M9.4 16.5a2.6 2.6 0 0 1 5.2 0" {...S} />
    </Icon>
  );
}

export function ForumTrophyIcon({ className, size, place = 1 } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M8.5 5.5h7v3.2a3.5 3.5 0 0 1-7 0V5.5z" {...S} />
      <path d="M8.5 7H6.2a2 2 0 0 0 2 2.8M15.5 7h2.3a2 2 0 0 1-2 2.8" {...S} />
      <path d="M10.2 15.2h3.6V17H10.2zM9 19.2h6" {...S} />
      {place <= 3 && (
        <path d="M12 9.2v2.4" {...S} />
      )}
    </Icon>
  );
}

const TOPIC_ICON = {
  全部: ForumFlameIcon,
  感情: HeaderHeartIcon,
  社群: ForumRainbowIcon,
  娛樂: ForumFilmIcon,
  命理: ForumCrystalIcon,
  興趣: ForumGamepadIcon,
  徵友: ForumBlossomIcon,
  親密話題: ForumIntimateIcon,
  寫故事: ForumBookIcon,
  官方公告: ForumMegaphoneIcon,
};

/** Topic filter / badge icon by forum topic name. */
export function ForumTopicIcon({ topic, size = 13, className } = {}) {
  const Comp = TOPIC_ICON[topic] || ForumFlameIcon;
  return <Comp size={size} className={className} />;
}

const SORT_ICON = {
  latest: ForumClockIcon,
  popular: ForumFlameIcon,
  clan: ForumPawIcon,
};

export function ForumSortIcon({ sortId, size = 13, className } = {}) {
  const Comp = SORT_ICON[sortId] || ForumClockIcon;
  return <Comp size={size} className={className} />;
}

export function ForumLikeStat({ count, size = 12 }) {
  return (
    <span className="forum-stat forum-stat--like">
      <HeaderHeartIcon size={size} className="forum-stat__icon" />
      <span>{count}</span>
    </span>
  );
}

export function ForumCommentStat({ count, size = 12 }) {
  return (
    <span className="forum-stat forum-stat--comment">
      <HeaderChatIcon size={size} className="forum-stat__icon" />
      <span>{count}</span>
    </span>
  );
}

export {
  HeaderHeartIcon,
  HeaderChatIcon,
  HeaderCalendarIcon,
  HeaderShieldIcon,
  HeaderBookmarkIcon,
  HeaderForumIcon,
  HeaderUserPlusIcon,
  HeaderMailIcon,
};
