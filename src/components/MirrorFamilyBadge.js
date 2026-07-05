import { getFamilyMeta } from '../lib/mirror-personality.js';

/**
 * Mirror cat family badge — compact (post cards) or hero (sort bar).
 */
export default function MirrorFamilyBadge({
  type,
  variant = 'compact',
  className = '',
  title,
  showImage = false,
}) {
  const meta = getFamilyMeta(type);
  if (!meta) return null;

  const rootClass = [
    'mirror-family-badge',
    `mirror-family-badge--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  const tip = title || `${meta.nameZh} · ${meta.nameEn} · ${meta.factorName}`;

  if (variant === 'hero') {
    return (
      <span
        className={rootClass}
        data-family={meta.key}
        style={{ '--family-color': meta.color, '--family-glow': meta.glow }}
        title={tip}
      >
        {showImage && meta.img && (
          <span className="mirror-family-badge__avatar" aria-hidden="true">
            <img src={meta.img} alt="" width={24} height={24} />
          </span>
        )}
        <span className="mirror-family-badge__name">{meta.nameZh}</span>
      </span>
    );
  }

  return (
    <span
      className={rootClass}
      data-family={meta.key}
      style={{ '--family-color': meta.color, '--family-glow': meta.glow }}
      title={tip}
    >
      <span className="mirror-family-badge__emoji" aria-hidden="true">{meta.emoji}</span>
      <span className="mirror-family-badge__name">{meta.nameZh}</span>
    </span>
  );
}
