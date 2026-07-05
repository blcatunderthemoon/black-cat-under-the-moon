import Link from 'next/link';
import { FORUM_DISPLAY_NAME } from '../lib/forum-welcome.js';

export default function ForumHeaderLogo({ href = '/forum', className = '' }) {
  return (
    <Link
      href={href}
      className={`forum-header-logo ${className}`.trim()}
      aria-label={FORUM_DISPLAY_NAME}
    >
      <img
        src="/forumlogo.png"
        alt=""
        className="forum-header-logo__img"
        width={132}
        height={132}
        decoding="async"
        draggable={false}
      />
    </Link>
  );
}
