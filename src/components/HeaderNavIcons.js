/**
 * Shared monochrome stroke icons for headers + inbox system notices.
 * Match guest login SVG in auth-nav.js (currentColor, 1.75 stroke).
 */

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  'aria-hidden': true,
};

function Icon({ children, className = '', size = 16, ...rest }) {
  const cls = className ? `header-nav-icon ${className}` : 'header-nav-icon';
  return (
    <svg
      {...BASE}
      className={cls}
      width={size}
      height={size}
      {...rest}
    >
      {children}
    </svg>
  );
}

const STROKE = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** Moonlight gatherings */
export function HeaderCalendarIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="4" y="5.5" width="16" height="14" rx="1.5" {...STROKE} />
      <path d="M4 10h16" {...STROKE} />
      <path d="M9 3.5v3.5M15 3.5v3.5" {...STROKE} />
      <path d="M8 14h2.5M13.5 14H16" {...STROKE} />
    </Icon>
  );
}

/** Moonlight wishes */
export function HeaderWishIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M6 4.5v15" {...STROKE} />
      <path d="M6 5.5h10.5l-2 3.2 2 3.2H6" {...STROKE} />
      <path d="M16.5 15.2l1.2 2.4 2.6.3-2 1.8.5 2.5-2.3-1.4-2.3 1.4.5-2.5-2-1.8 2.6-.3z" {...STROKE} />
    </Icon>
  );
}

/** Inbox */
export function HeaderMailIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <rect x="3.5" y="6" width="17" height="12.5" rx="1.5" {...STROKE} />
      <path d="M4.2 7.8 12 13.2 19.8 7.8" {...STROKE} />
    </Icon>
  );
}

/** Account / settings — gear (not sun/brightness) */
export function HeaderSettingsIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="3" {...STROKE} />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        {...STROKE}
      />
    </Icon>
  );
}

/** Forum bookmarks */
export function HeaderBookmarkIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M7.5 4.5h9v15.5L12 16.2 7.5 20V4.5z" {...STROKE} />
    </Icon>
  );
}

/** Forum guardian / moderation */
export function HeaderShieldIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 3.5 19.5 6.5v5.2c0 4.6-3.2 7.8-7.5 9.3-4.3-1.5-7.5-4.7-7.5-9.3V6.5L12 3.5z" {...STROKE} />
    </Icon>
  );
}

export function HeaderCheckIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="8.25" {...STROKE} />
      <path d="M8 12.2 10.8 15 16.2 9.2" {...STROKE} />
    </Icon>
  );
}

export function HeaderCancelIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="8.25" {...STROKE} />
      <path d="M9 9l6 6M15 9l-6 6" {...STROKE} />
    </Icon>
  );
}

export function HeaderUserPlusIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <circle cx="9.5" cy="8.5" r="3" {...STROKE} />
      <path d="M4.2 18.5c.9-3 2.7-4.5 5.3-4.5s4.4 1.5 5.3 4.5" {...STROKE} />
      <path d="M17 9v6M14 12h6" {...STROKE} />
    </Icon>
  );
}

export function HeaderSendIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M4.5 11.5 19.5 4.5 14 19.5 11.2 12.8 4.5 11.5z" {...STROKE} />
      <path d="M11.2 12.8 19.5 4.5" {...STROKE} />
    </Icon>
  );
}

export function HeaderChatIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M5 6.5h14v9.5H11l-3.5 3v-3H5V6.5z" {...STROKE} />
    </Icon>
  );
}

export function HeaderHeartIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path
        d="M12 19.2s-6.8-4.1-6.8-9A3.7 3.7 0 0 1 12 7.2a3.7 3.7 0 0 1 6.8 3c0 4.9-6.8 9-6.8 9z"
        {...STROKE}
      />
    </Icon>
  );
}

export function HeaderBellIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M7 16.5h10M8.2 16.5V11a3.8 3.8 0 0 1 7.6 0v5.5" {...STROKE} />
      <path d="M10.2 16.5a1.8 1.8 0 0 0 3.6 0" {...STROKE} />
      <path d="M12 4.5v1.2" {...STROKE} />
    </Icon>
  );
}

export function HeaderForumIcon({ className, size } = {}) {
  return (
    <Icon className={className} size={size}>
      <path d="M6 5.5h12v13H6z" {...STROKE} />
      <path d="M9 9h6M9 12.5h6M9 16h4" {...STROKE} />
    </Icon>
  );
}

/**
 * Map system-notice payload.kind → stroke icon.
 * @param {{ kind?: string, size?: number, className?: string }} props
 */
export function SystemNoticeIcon({ kind = '', size = 18, className } = {}) {
  const k = String(kind || '');
  const props = { size, className };
  if (k === 'gathering_cancelled') return <HeaderCancelIcon {...props} />;
  if (k === 'gathering_approved' || k === 'gathering_joined') return <HeaderCheckIcon {...props} />;
  if (k === 'gathering_rejected') return <HeaderCancelIcon {...props} />;
  if (k === 'gathering_application') return <HeaderUserPlusIcon {...props} />;
  if (k === 'gathering_applied') return <HeaderSendIcon {...props} />;
  if (k === 'gathering_moderation_alert' || k === 'forum_moderation_alert') {
    return <HeaderShieldIcon {...props} />;
  }
  if (k === 'forum_post_liked' || k === 'forum_comment_liked') return <HeaderHeartIcon {...props} />;
  if (k === 'forum_post_commented' || k === 'forum_comment_reply') return <HeaderChatIcon {...props} />;
  if (k === 'wish_cheer' || k === 'wish_completed' || k.startsWith('wish_')) return <HeaderWishIcon {...props} />;
  if (k.startsWith('forum_')) return <HeaderForumIcon {...props} />;
  if (k.startsWith('gathering_')) return <HeaderCalendarIcon {...props} />;
  return <HeaderBellIcon {...props} />;
}

/** Inline SVG markup for static auth-nav.js (keep paths in sync with components above). */
export const HEADER_NAV_ICON_SVG = {
  calendar:
    '<svg class="header-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
    + '<rect x="4" y="5.5" width="16" height="14" rx="1.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M4 10h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
    + '<path d="M9 3.5v3.5M15 3.5v3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
    + '<path d="M8 14h2.5M13.5 14H16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
    + '</svg>',
  mail:
    '<svg class="header-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
    + '<rect x="3.5" y="6" width="17" height="12.5" rx="1.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M4.2 7.8 12 13.2 19.8 7.8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>',
  settings:
    '<svg class="header-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
    + '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/>'
    + '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>',
};

/** Strip leading emoji / pictographs from legacy system-notice body text. */
export function stripLeadingNoticeDecor(text) {
  return String(text || '')
    .replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, '')
    .trim();
}
