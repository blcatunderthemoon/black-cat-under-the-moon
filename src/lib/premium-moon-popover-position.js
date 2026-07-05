/** Viewport-safe fixed position for Moonlight Passport header popover. */
export function computePremiumMoonPopoverPosition(
  badgeRect,
  popoverW,
  popoverH,
  { preferAbove = false, pad = 8, gap = 6 } = {},
) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
  const safeW = Math.min(popoverW, vw - pad * 2);

  let top = preferAbove ? badgeRect.top - popoverH - gap : badgeRect.bottom + gap;
  if (!preferAbove && top + popoverH > vh - pad) {
    const aboveTop = badgeRect.top - popoverH - gap;
    if (aboveTop >= pad) top = aboveTop;
  }
  top = Math.max(pad, Math.min(top, vh - popoverH - pad));

  const badgeCenter = badgeRect.left + badgeRect.width / 2;
  let left = badgeCenter < vw / 2
    ? badgeRect.left
    : badgeRect.right - safeW;
  left = Math.max(pad, Math.min(left, vw - safeW - pad));

  return { top, left, width: safeW };
}
