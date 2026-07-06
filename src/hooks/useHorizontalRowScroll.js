/**
 * Horizontal scroll for overflow rows (hidden scrollbar + wheel + drag).
 *
 * Usage:
 *   <div ref={ref} className="… forum-h-scroll">…chips/buttons…</div>
 *   useHorizontalRowScroll(ref, null, true);
 *
 * Desktop (mouse): mousedown + document mousemove — works when dragging from <button>.
 * Touch: pointer events + setPointerCapture.
 */
import { useLayoutEffect } from 'react';

const DRAG_THRESHOLD_PX = 5;
const DESKTOP_DRAG_MQ = '(hover: hover) and (pointer: fine)';

export default function useHorizontalRowScroll(rowRef, dragRef, active = true) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const row = rowRef.current;
    if (!row) return undefined;

    const useMouseDrag = typeof window !== 'undefined'
      && window.matchMedia(DESKTOP_DRAG_MQ).matches;

    let activePointerId = null;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let suppressClick = false;
    let tracking = false;

    function maxScrollLeft() {
      return Math.max(0, row.scrollWidth - row.clientWidth);
    }

    function isScrollable() {
      return maxScrollLeft() > 0;
    }

    function applyDrag(clientX) {
      const dx = clientX - startX;
      row.scrollLeft = Math.max(0, Math.min(startScroll - dx, maxScrollLeft()));
    }

    function onMove(clientX, e) {
      if (!tracking) return;
      const dx = clientX - startX;
      if (!dragging && Math.abs(dx) > DRAG_THRESHOLD_PX) {
        dragging = true;
        row.classList.add('forum-h-scroll--dragging');
        row.classList.remove('forum-h-scroll--tracking');
      }
      if (dragging) {
        e?.preventDefault?.();
        applyDrag(clientX);
      }
    }

    function begin(clientX) {
      if (!isScrollable()) return false;
      startX = clientX;
      startScroll = row.scrollLeft;
      dragging = false;
      suppressClick = false;
      tracking = true;
      row.classList.add('forum-h-scroll--tracking');
      return true;
    }

    function finish(e) {
      if (!tracking) return;
      if (e?.pointerId !== undefined && activePointerId !== null && e.pointerId !== activePointerId) {
        return;
      }

      row.classList.remove('forum-h-scroll--tracking', 'forum-h-scroll--dragging');

      if (dragging) {
        suppressClick = true;
        if (dragRef) dragRef.current = true;
      }

      if (!useMouseDrag && activePointerId !== null) {
        try {
          row.releasePointerCapture(activePointerId);
        } catch {
          /* ignore */
        }
      }

      tracking = false;
      dragging = false;
      activePointerId = null;
    }

    function onWheel(e) {
      if (!isScrollable()) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      row.scrollLeft += delta;
    }

    function onMouseDown(e) {
      if (!useMouseDrag || e.button !== 0 || tracking) return;
      begin(e.clientX);
    }

    function onMouseMove(e) {
      if (!useMouseDrag || !tracking) return;
      onMove(e.clientX, e);
    }

    function onMouseUp() {
      if (!useMouseDrag || !tracking) return;
      finish();
    }

    function onPointerDown(e) {
      if (useMouseDrag || e.button !== 0 || tracking) return;
      if (!begin(e.clientX)) return;
      activePointerId = e.pointerId;
      try {
        row.setPointerCapture(e.pointerId);
      } catch {
        /* unsupported */
      }
    }

    function onPointerMove(e) {
      if (useMouseDrag || !tracking || e.pointerId !== activePointerId) return;
      onMove(e.clientX, e);
    }

    function onPointerEnd(e) {
      if (useMouseDrag || !tracking) return;
      finish(e);
    }

    function onClickCapture(e) {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
      if (dragRef) dragRef.current = false;
    }

    row.addEventListener('wheel', onWheel, { passive: false });
    row.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    row.addEventListener('pointerdown', onPointerDown, true);
    row.addEventListener('pointermove', onPointerMove);
    row.addEventListener('pointerup', onPointerEnd);
    row.addEventListener('pointercancel', onPointerEnd);
    row.addEventListener('click', onClickCapture, true);
    row.addEventListener('dragstart', (e) => e.preventDefault());

    return () => {
      row.removeEventListener('wheel', onWheel);
      row.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      row.removeEventListener('pointerdown', onPointerDown, true);
      row.removeEventListener('pointermove', onPointerMove);
      row.removeEventListener('pointerup', onPointerEnd);
      row.removeEventListener('pointercancel', onPointerEnd);
      row.removeEventListener('click', onClickCapture, true);
      row.classList.remove('forum-h-scroll--tracking', 'forum-h-scroll--dragging');
      tracking = false;
      dragging = false;
      activePointerId = null;
    };
  }, [rowRef, dragRef, active]);
}
