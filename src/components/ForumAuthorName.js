import Link from 'next/link';
import PremiumMoonBadge from './PremiumMoonBadge.js';
import { mirrorCardHref } from '../lib/profile-links.js';

export default function ForumAuthorName({
  name,
  isMine = false,
  isPremium = false,
  mirrorSlug = null,
  onLinkClick,
}) {
  const href = mirrorCardHref({ isMine, slug: mirrorSlug });
  const label = name || '神秘貓咪';
  const nameEl = (
    <>
      {label}
      {isPremium && <PremiumMoonBadge className="forum-author-moon" />}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="pixel-link forum-author-name"
        onClick={onLinkClick}
      >
        {nameEl}
      </Link>
    );
  }

  return <span className="forum-author-name">{nameEl}</span>;
}
