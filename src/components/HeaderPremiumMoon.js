import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PremiumMoonBadge from './PremiumMoonBadge.js';
import PremiumMoonPopover from './PremiumMoonPopover.js';
import { computePremiumMoonPopoverPosition } from '../lib/premium-moon-popover-position.js';
import { getActiveLetterQuotaLine, getPremiumStatusMessage, MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';

/** Header-only moon — hover (desktop) or tap (mobile) to show premium status popover. */
export default function HeaderPremiumMoon({ profile, className = '' }) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef(null);
  const popoverRef = useRef(null);

  const statusMessage = getPremiumStatusMessage(profile) || `${MOONLIGHT_PASSPORT_BRAND} 會籍有效`;
  const quotaLine = getActiveLetterQuotaLine(profile);

  const positionPopover = useCallback(() => {
    const wrap = wrapRef.current;
    const badge = wrap?.querySelector('.premium-moon-badge');
    const popover = popoverRef.current;
    if (!badge) return;
    const rect = badge.getBoundingClientRect();
    const popoverW = popover?.offsetWidth || 210;
    const popoverH = popover?.offsetHeight || 72;
    const preferAbove = Boolean(wrap?.closest('.auth-nav-badge--user-toolbar'));
    const pos = computePremiumMoonPopoverPosition(rect, popoverW, popoverH, { preferAbove });
    setPopoverStyle({
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      width: pos.width,
      right: 'auto',
      zIndex: 10005,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return undefined;
    }
    positionPopover();
    const raf1 = requestAnimationFrame(() => {
      positionPopover();
      requestAnimationFrame(positionPopover);
    });
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [open, positionPopover, statusMessage, quotaLine]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      const wrap = wrapRef.current;
      const popover = popoverRef.current;
      if (wrap?.contains(e.target) || popover?.contains(e.target)) return;
      setOpen(false);
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

  const portaledPopover = open && mounted && typeof document !== 'undefined'
    ? createPortal(
      <PremiumMoonPopover
        ref={popoverRef}
        statusMessage={statusMessage}
        quotaLine={quotaLine}
        style={popoverStyle}
        portaled
      />,
      document.body,
    )
    : null;

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
      {portaledPopover}
    </span>
  );
}
