/** 16×16 pixel crescent moon — scaled with crisp edges */
export default function PixelMoonIcon({ className = 'pixel-moon-icon', size = 36 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <circle cx="7" cy="8" r="5" fill="#ffe066" />
      <circle cx="10.5" cy="7.5" r="4.5" fill="#0e0d1c" />
    </svg>
  );
}
