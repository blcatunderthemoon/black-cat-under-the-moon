/** Pixel sealed envelope with moon wax seal */
export default function PixelSealedLetterIcon({
  className = 'letter-icon',
  variant = 'sealed',
  size = 40,
}) {
  const isSealed = variant === 'sealed';
  const isGlow = variant === 'sealed-glow';

  return (
    <svg
      className={`${className}${isGlow ? ' letter-icon--sealed-glow' : ''}${!isSealed ? ' letter-icon--read' : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {/* Envelope body */}
      <rect x="3" y="7" width="18" height="13" fill={isSealed ? '#3a3560' : '#252240'} />
      <rect x="3" y="7" width="18" height="13" fill="none" stroke="#a894ff" strokeWidth="1" opacity={isSealed ? 0.9 : 0.5} />
      {/* Flap */}
      <polygon
        points="3,7 12,13 21,7"
        fill={isSealed ? '#4a4468' : '#302850'}
        stroke="#a894ff"
        strokeWidth="0.5"
        opacity={isSealed ? 0.95 : 0.55}
      />
      {/* Wax seal */}
      {isSealed && (
        <>
          <circle cx="12" cy="14" r="4" fill="#c9a227" />
          <circle cx="12" cy="14" r="3.5" fill="#b8922a" />
          {/* Moon on seal */}
          <circle cx="11" cy="14" r="1.8" fill="#ffe066" />
          <circle cx="12.2" cy="13.8" r="1.5" fill="#b8922a" />
          {/* Paw print hint */}
          <rect x="10.5" y="15.5" width="1" height="1" fill="#8a7020" />
          <rect x="12.5" y="15.5" width="1" height="1" fill="#8a7020" />
          <rect x="11.5" y="16.5" width="1" height="1" fill="#8a7020" />
        </>
      )}
      {!isSealed && (
        <>
          {/* Open letter peek */}
          <rect x="8" y="11" width="8" height="6" fill="#e8d5a3" opacity="0.6" />
          <rect x="9" y="12" width="6" height="1" fill="#8a7020" opacity="0.4" />
          <rect x="9" y="14" width="4" height="1" fill="#8a7020" opacity="0.3" />
        </>
      )}
    </svg>
  );
}
