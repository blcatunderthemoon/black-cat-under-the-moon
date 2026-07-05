/** Popover below header premium moon (hover desktop / tap mobile). */
export default function PremiumMoonPopover({ statusMessage, quotaLine, style = undefined }) {
  if (!statusMessage) return null;
  return (
    <div className="premium-moon-popover" role="tooltip" style={style}>
      <p className="premium-moon-popover__line premium-moon-popover__line--status">
        <span className="premium-moon-popover__glyph" aria-hidden="true">🌙</span>
        {statusMessage}
      </p>
      {quotaLine && (
        <p className="premium-moon-popover__line premium-moon-popover__line--quota">
          {quotaLine}
        </p>
      )}
    </div>
  );
}
