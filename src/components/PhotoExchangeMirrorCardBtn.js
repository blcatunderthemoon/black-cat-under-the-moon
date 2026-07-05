import Link from 'next/link';
import PixelMixedLabel from './PixelMixedLabel.js';

export default function PhotoExchangeMirrorCardBtn({ href, className = '' }) {
  if (!href) return null;
  return (
    <Link
      href={href}
      className={`pixel-btn photo-exchange-mirror-btn${className ? ` ${className}` : ''}`}
    >
      <PixelMixedLabel text="查看對方 Mirror Card →" />
    </Link>
  );
}
