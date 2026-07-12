/**
 * HeaderMyCatLink — the ONLY navigation entry to /my-cat (§1.3, docs/MY-CAT-GAME-DESIGN.md).
 * Shared by AppHeaderAuth and ForumHeaderAuth; shows a hungry-dot badge
 * when today's feed (= daily check-in) hasn't happened yet.
 */

import Link from 'next/link';
import { MY_CAT_PATH } from '../lib/my-cat.js';

export default function HeaderMyCatLink({
  needsFeedBadge = false,
  variant = 'app', // 'app' → auth-nav-badge classes; 'forum' → forum header classes
}) {
  const isForum = variant === 'forum';
  const linkClass = isForum
    ? 'app-header__nav-link app-header__nav-link--icon header-my-cat-link header-my-cat-link--forum'
    : 'auth-nav-badge__item auth-nav-badge__item--icon header-my-cat-link';

  return (
    <Link
      href={MY_CAT_PATH}
      className={`${linkClass}${needsFeedBadge ? ' header-my-cat-link--hungry' : ''}`}
      title={needsFeedBadge ? '我的月光貓 · 今日未餵食' : '我的月光貓'}
      aria-label="我的月光貓"
    >
      <span className="header-my-cat-link__sprite" aria-hidden="true" />
      {needsFeedBadge && <span className="header-my-cat-link__dot" aria-hidden="true" />}
    </Link>
  );
}
