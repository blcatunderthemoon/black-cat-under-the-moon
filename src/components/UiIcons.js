/**
 * Shared UI stroke icons — single import surface for the website.
 *
 * Style: currentColor, strokeWidth 1.75, round caps/joins, 24×24 viewBox.
 * Prefer these over emoji for all product UI chrome (nav, badges, empty states,
 * section titles, stats). See docs/overview/UI-ICON-SYSTEM.md.
 */

import { ForumCrystalIcon, ForumMoonIcon } from './ForumIcons.js';
import { HeaderShieldIcon } from './HeaderNavIcons.js';

export {
  HeaderCalendarIcon,
  HeaderMailIcon,
  HeaderSettingsIcon,
  HeaderBookmarkIcon,
  HeaderShieldIcon,
  HeaderCheckIcon,
  HeaderCancelIcon,
  HeaderUserPlusIcon,
  HeaderSendIcon,
  HeaderChatIcon,
  HeaderHeartIcon,
  HeaderBellIcon,
  HeaderForumIcon,
  SystemNoticeIcon,
} from './HeaderNavIcons.js';

export {
  ForumFlameIcon,
  ForumClockIcon,
  ForumPawIcon,
  ForumPinIcon,
  ForumSparkleIcon,
  ForumMegaphoneIcon,
  ForumFilmIcon,
  ForumCrystalIcon,
  ForumGamepadIcon,
  ForumBookIcon,
  ForumBlossomIcon,
  ForumMoonIcon,
  ForumIntimateIcon,
  ForumLockIcon,
  ForumEyeIcon,
  ForumSearchIcon,
  ForumScrollIcon,
  ForumRainbowIcon,
  ForumTrophyIcon,
  ForumTopicIcon,
  ForumSortIcon,
  ForumLikeStat,
  ForumCommentStat,
} from './ForumIcons.js';


const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  'aria-hidden': true,
};

function Icon({ children, className = '', size = 16, ...rest }) {
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

export function UiCameraIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M4.5 8.5h3.2l1.3-2h6l1.3 2H19.5v10H4.5V8.5z" {...S} />
      <circle cx="12" cy="13.2" r="3.2" {...S} />
    </Icon>
  );
}

export function UiBoltIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M13 3.5 7.5 13h4.2L11 20.5 16.5 11h-4.2L13 3.5z" {...S} />
    </Icon>
  );
}

export function UiPhoneIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="7.5" y="3.5" width="9" height="17" rx="1.8" {...S} />
      <path d="M11 17.5h2" {...S} />
    </Icon>
  );
}

export function UiFlagIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M6 4.5v15" {...S} />
      <path d="M6 5.5h10.5l-2 3.2 2 3.2H6" {...S} />
    </Icon>
  );
}

export function UiWarningIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 4.5 20 18.5H4L12 4.5z" {...S} />
      <path d="M12 10v4.2M12 16.8h.01" {...S} />
    </Icon>
  );
}

export function UiChartIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M5 18.5V11M10 18.5V6.5M15 18.5v-5M20 18.5V9" {...S} />
    </Icon>
  );
}

export function UiImageIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="4" y="5.5" width="16" height="13" rx="1.5" {...S} />
      <circle cx="9" cy="10" r="1.4" {...S} />
      <path d="M4.8 16.5 9.5 12l3 2.5 2.8-3.2 4 5.2" {...S} />
    </Icon>
  );
}

export function UiPenIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M14.5 5.5 18.5 9.5 9 19H5v-4L14.5 5.5z" {...S} />
      <path d="M12.8 7.2 16.8 11.2" {...S} />
    </Icon>
  );
}

export function UiHomeIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M4.5 11 12 4.5 19.5 11" {...S} />
      <path d="M7 10.2V19h10v-8.8" {...S} />
    </Icon>
  );
}

export function UiSunIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="3.4" {...S} />
      <path d="M12 4.2v2M12 17.8v2M4.2 12h2M17.8 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M16.2 7.8l1.4-1.4M6.4 17.6l1.4-1.4" {...S} />
    </Icon>
  );
}

export function UiSignalIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M5 15.5a9 9 0 0 1 14 0" {...S} />
      <path d="M7.8 13a5.2 5.2 0 0 1 8.4 0" {...S} />
      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function UiUnlockIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="6.5" y="11" width="11" height="8.5" rx="1.5" {...S} />
      <path d="M9 11V8.2a3 3 0 0 1 5.7-1.2" {...S} />
    </Icon>
  );
}

export function UiTvIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="3.5" y="6" width="17" height="11.5" rx="1.5" {...S} />
      <path d="M9 20h6M12 17.5V20" {...S} />
    </Icon>
  );
}

export function UiFishIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M4.5 12s3.5-5 8.5-5c4 0 6.5 2.2 6.5 5s-2.5 5-6.5 5c-5 0-8.5-5-8.5-5z" {...S} />
      <circle cx="15.5" cy="11.2" r="0.9" fill="currentColor" stroke="none" />
      <path d="M4.5 12l-2-2.5M4.5 12l-2 2.5" {...S} />
    </Icon>
  );
}

export function UiCanIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M8 6.5h8l.8 2.2v10.8H7.2V8.7L8 6.5z" {...S} />
      <path d="M7.5 9h9" {...S} />
    </Icon>
  );
}

export function UiCartIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M4.5 5.5h2.2l1.4 9.2h9.6l1.8-6.5H8.2" {...S} />
      <circle cx="10.2" cy="18" r="1.2" {...S} />
      <circle cx="16.2" cy="18" r="1.2" {...S} />
    </Icon>
  );
}

/** Mirror family type → stroke icon (replaces MIRROR_EMOJI in chrome). */
export function MirrorTypeIcon({ type, size = 14, className } = {}) {
  const t = String(type || '').toLowerCase();
  if (t === 'sunny') return <UiSunIcon size={size} className={className} />;
  if (t === 'mystical') return <ForumCrystalIcon size={size} className={className} />;
  if (t === 'sentinel') return <HeaderShieldIcon size={size} className={className} />;
  return <ForumMoonIcon size={size} className={className} />;
}
