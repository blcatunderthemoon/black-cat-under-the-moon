/** Pixel envelope with photo peek — inbox photo exchange threads */
export default function PixelPhotoExchangeIcon({
  className = 'letter-icon',
  variant = 'sealed',
  size = 40,
}) {
  const isGlow = variant === 'sealed-glow';
  const isRead = variant === 'read';

  return (
    <svg
      className={`${className} letter-icon--photo-exchange${isGlow ? ' letter-icon--photo-glow' : ''}${isRead ? ' letter-icon--read' : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="3" y="7" width="18" height="13" fill={isRead ? '#1e1a34' : '#2d2848'} />
      <rect x="3" y="7" width="18" height="13" fill="none" stroke="#9b7cff" strokeWidth="1" opacity={isRead ? 0.45 : 0.85} />
      <polygon
        points="3,7 12,13 21,7"
        fill={isRead ? '#282240' : '#3a3458'}
        stroke="#9b7cff"
        strokeWidth="0.5"
        opacity={isRead ? 0.5 : 0.9}
      />
      {/* Photo peeking from envelope */}
      <rect x="7" y="10" width="10" height="7" fill="#c8d8e8" opacity={isRead ? 0.55 : 0.92} />
      <rect x="8" y="11" width="8" height="5" fill="#88a8c8" opacity={isRead ? 0.4 : 0.7} />
      <rect x="9.5" y="12.5" width="2.5" height="2" fill="#f0e8d8" opacity={isRead ? 0.5 : 0.85} />
      <rect x="12.5" y="12" width="3" height="2" fill="#5a7898" opacity={isRead ? 0.45 : 0.75} />
    </svg>
  );
}
