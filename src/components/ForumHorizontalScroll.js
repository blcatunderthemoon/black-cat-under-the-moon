import { forwardRef, useRef, useCallback } from 'react';
import useHorizontalRowScroll from '../hooks/useHorizontalRowScroll.js';

/**
 * Scrollable horizontal strip for forum topic badges and tag chips.
 * Always applies `.forum-h-scroll` so overflow + touch swipe stay consistent.
 */
const ForumHorizontalScroll = forwardRef(function ForumHorizontalScroll({
  className = '',
  enabled = true,
  children,
  ...rest
}, forwardedRef) {
  const innerRef = useRef(null);
  const setRef = useCallback((node) => {
    innerRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  useHorizontalRowScroll(innerRef, enabled);

  const classes = className ? `forum-h-scroll ${className}` : 'forum-h-scroll';

  return (
    <div ref={setRef} className={classes} {...rest}>
      {children}
    </div>
  );
});

export default ForumHorizontalScroll;
