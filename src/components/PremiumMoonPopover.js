import { forwardRef } from 'react';
import { ForumMoonIcon } from './ForumIcons.js';

/** Popover below header premium moon (hover desktop / tap mobile). */
const PremiumMoonPopover = forwardRef(function PremiumMoonPopover({
  statusMessage,
  quotaLine,
  style = undefined,
  portaled = false,
}, ref) {
  if (!statusMessage) return null;
  return (
    <div
      ref={ref}
      className={`premium-moon-popover${portaled ? ' premium-moon-popover--portal' : ''}`}
      role="tooltip"
      style={style}
    >
      <p className="premium-moon-popover__line premium-moon-popover__line--status">
        <span className="premium-moon-popover__glyph" aria-hidden="true">
          <ForumMoonIcon size={13} />
        </span>
        {statusMessage}
      </p>
      {quotaLine && (
        <p className="premium-moon-popover__line premium-moon-popover__line--quota">
          {quotaLine}
        </p>
      )}
    </div>
  );
});

export default PremiumMoonPopover;
