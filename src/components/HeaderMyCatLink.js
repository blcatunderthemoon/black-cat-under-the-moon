/**
 * HeaderMyCatLink — the ONLY navigation entry to /my-cat (§1.3, docs/MY-CAT-GAME-DESIGN.md).
 * Shared by AppHeaderAuth and ForumHeaderAuth; shows a hungry-dot badge
 * when today's feed (= daily check-in) hasn't happened yet.
 */

import Link from 'next/link';
import { MY_CAT_PATH, DEFAULT_SKIN_ID, getCatStripUrl, getCatAnimMeta } from '../lib/my-cat.js';

const HEADER_ICON_ANIM = 'idle_slowblink';
// Icon box vs drawn frame. Family skins use idle strip frame 0.
// Frame > box zooms into the cat so other skins read clearly in the header.
const HEADER_ICON_BOX = 28;
const HEADER_ICON_FRAME = 34; // displayed size (source frames are 40px)
const CAT_CENTER_X = 0.45; // 18/40 — cat sits slightly left of centre
const CAT_CENTER_Y = 0.55; // slightly raised so ears stay inside the clip

export default function HeaderMyCatLink({
  needsFeedBadge = false,
  skinId = DEFAULT_SKIN_ID,
  variant = 'app', // 'app' → auth-nav-badge classes; 'forum' → forum header classes
}) {
  const isForum = variant === 'forum';
  const linkClass = isForum
    ? 'app-header__nav-link app-header__nav-link--icon header-my-cat-link header-my-cat-link--forum'
    : 'auth-nav-badge__item auth-nav-badge__item--icon header-my-cat-link';

  // 預設小黑貓用手繪 header icon；其他貓用 idle strip 第一幀，換貓即換 icon。
  const useStrip = skinId && skinId !== DEFAULT_SKIN_ID;
  let spriteStyle;
  if (useStrip) {
    const { frames } = getCatAnimMeta(HEADER_ICON_ANIM);
    const posX = HEADER_ICON_BOX / 2 - CAT_CENTER_X * HEADER_ICON_FRAME;
    const posY = HEADER_ICON_BOX / 2 - CAT_CENTER_Y * HEADER_ICON_FRAME;
    spriteStyle = {
      backgroundImage: `url(${getCatStripUrl(skinId, HEADER_ICON_ANIM)})`,
      backgroundSize: `${frames * HEADER_ICON_FRAME}px ${HEADER_ICON_FRAME}px`,
      backgroundPosition: `${posX}px ${posY}px`,
    };
  }

  return (
    <Link
      href={MY_CAT_PATH}
      className={`${linkClass}${needsFeedBadge ? ' header-my-cat-link--hungry' : ''}`}
      title={needsFeedBadge ? '我的月光貓 · 今日未餵食' : '我的月光貓'}
      aria-label="我的月光貓"
    >
      <span
        className={`header-my-cat-link__sprite${useStrip ? ' header-my-cat-link__sprite--strip' : ''}`}
        style={spriteStyle}
        aria-hidden="true"
      />
      {needsFeedBadge && <span className="header-my-cat-link__dot" aria-hidden="true" />}
    </Link>
  );
}
