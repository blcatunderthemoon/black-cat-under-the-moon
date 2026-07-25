/**
 * Horizontally scrollable header icon strip — edge fades + chevron when more exists.
 */

import { useEffect, useRef, useState } from 'react';

const NUDGE_KEY = 'header-icon-scroll-nudged';

export default function HeaderIconScrollGroup({
  className = '',
  trackClassName = 'forum-header-icon-group',
  children,
}) {
  const scrollerRef = useRef(null);
  const nudgedRef = useRef(false);
  const [flags, setFlags] = useState({ overflow: false, moreStart: false, moreEnd: false });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;

    function update() {
      const max = el.scrollWidth - el.clientWidth;
      const overflow = max > 3;
      const moreStart = overflow && el.scrollLeft > 3;
      const moreEnd = overflow && el.scrollLeft < max - 3;
      setFlags((prev) => {
        if (
          prev.overflow === overflow
          && prev.moreStart === moreStart
          && prev.moreEnd === moreEnd
        ) {
          return prev;
        }
        return { overflow, moreStart, moreEnd };
      });

      if (overflow && !nudgedRef.current && typeof window !== 'undefined') {
        let already = false;
        try {
          already = window.sessionStorage.getItem(NUDGE_KEY) === '1';
        } catch {
          already = false;
        }
        if (!already) {
          nudgedRef.current = true;
          try {
            window.sessionStorage.setItem(NUDGE_KEY, '1');
          } catch {
            /* ignore */
          }
          const start = el.scrollLeft;
          window.requestAnimationFrame(() => {
            el.scrollTo({ left: Math.min(start + 32, max), behavior: 'smooth' });
            window.setTimeout(() => {
              el.scrollTo({ left: start, behavior: 'smooth' });
            }, 480);
          });
        }
      }
    }

    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    const t = window.setTimeout(update, 160);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      window.clearTimeout(t);
      window.removeEventListener('resize', update);
    };
  }, [children]);

  const wrapClass = [
    'header-icon-scroll',
    className,
    flags.overflow ? 'is-scrollable' : '',
    flags.moreStart ? 'can-scroll-start' : '',
    flags.moreEnd ? 'can-scroll-end' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={wrapClass}>
      <span
        ref={scrollerRef}
        className={`header-icon-scroll__track ${trackClassName}`.trim()}
        tabIndex={flags.overflow ? 0 : undefined}
        role={flags.overflow ? 'region' : undefined}
        aria-label={flags.overflow ? '更多功能，左右滑動查看' : undefined}
      >
        {children}
      </span>
      {flags.moreStart ? (
        <span className="header-icon-scroll__fade header-icon-scroll__fade--start" aria-hidden="true">
          <span className="header-icon-scroll__chev" />
        </span>
      ) : null}
      {flags.moreEnd ? (
        <span className="header-icon-scroll__fade header-icon-scroll__fade--end" aria-hidden="true">
          <span className="header-icon-scroll__chev" />
        </span>
      ) : null}
    </span>
  );
}
