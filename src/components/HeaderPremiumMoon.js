import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import PremiumMoonBadge from './PremiumMoonBadge.js';
import PremiumMoonPopover from './PremiumMoonPopover.js';
import { getActiveLetterQuotaLine, getPremiumStatusMessage, MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';

/** Header-only moon — hover (desktop) or tap (mobile) to show premium status popover. */
export default function HeaderPremiumMoon({ profile, className = '' }) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const wrapRef = useRef(null);

  const statusMessage = getPremiumStatusMessage(profile) || `${MOONLIGHT_PASSPORT_BRAND} 會籍有效`;
  const quotaLine = getActiveLetterQuotaLine(profile);

  const positionPopover = useCallback(() => {
    const badge = wrapRef.current?.querySelector('.premium-moon-badge');
    if (!badge) return;
    const rect = badge.getBoundingClientRect();
    setPopoverStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      left: 'auto',
      zIndex: 10005,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return undefined;
    }
    positionPopover();
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
    return () => {
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [open, positionPopover]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function handleToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }

  return (
    <span
      ref={wrapRef}
      className={`header-premium-moon-wrap${open ? ' header-premium-moon-wrap--open' : ''}`}
    >
      <PremiumMoonBadge
        className={className}
        title={`${MOONLIGHT_PASSPORT_BRAND} 狀態`}
        interactive
        ariaExpanded={open}
        onClick={handleToggle}
      />
      <PremiumMoonPopover
        statusMessage={statusMessage}
        quotaLine={quotaLine}
        style={open ? popoverStyle : undefined}
      />
    </span>
  );
}
