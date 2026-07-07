/**
 * Horizontal scroll rows: hidden scrollbar, native touch swipe, desktop drag + wheel.
 *
 * - Touch / coarse pointer: no custom drag — rely on overflow-x + touch-action (pan-x).
 * - Fine pointer (mouse): pointer drag after threshold; wheel scroll when hovered.
 */
import { useLayoutEffect } from 'react';

const DRAG_THRESHOLD_PX = 5;
const FINE_POINTER_MQ = '(hover: hover) and (pointer: fine)';

export default function useHorizontalRowScroll(rowRef, active = true) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const row = rowRef.current;
    if (!row) return undefined;

    let finePointer = typeof window !== 'undefined'
      && window.matchMedia(FINE_POINTER_MQ).matches;

    const mq = typeof window !== 'undefined' ? window.matchMedia(FINE_POINTER_MQ) : null;

    let pointerId = null;
    let startX = 0;
    let startScroll = 0;
    let tracking = false;
    let dragging = false;
    let suppressClick = false;

    function maxScrollLeft() {
      return Math.max(0, row.scrollWidth - row.clientWidth);
    }

    function canScroll() {
      return maxScrollLeft() > 1;
    }

    function applyDrag(clientX) {
      if (!canScroll()) return;
      const dx = clientX - startX;
      row.scrollLeft = Math.max(0, Math.min(startScroll - dx, maxScrollLeft()));
    }

    function resetDragState() {
      row.classList.remove('forum-h-scroll--tracking', 'forum-h-scroll--dragging');
      if (pointerId !== null) {
        try {
          row.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      }
      tracking = false;
      dragging = false;
      pointerId = null;
    }

    function onWheel(e) {
      if (!canScroll()) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      row.scrollLeft = Math.max(0, Math.min(row.scrollLeft + delta, maxScrollLeft()));
    }

    function onPointerDown(e) {
      if (!finePointer || e.button !== 0 || tracking) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = row.scrollLeft;
      tracking = true;
      dragging = false;
      row.classList.add('forum-h-scroll--tracking');
    }

    function onPointerMove(e) {
      if (!finePointer || !tracking || e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) <= DRAG_THRESHOLD_PX) return;
        if (!canScroll()) {
          resetDragState();
          return;
        }
        dragging = true;
        row.classList.add('forum-h-scroll--dragging');
        row.classList.remove('forum-h-scroll--tracking');
        try {
          row.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      }

      e.preventDefault();
      applyDrag(e.clientX);
    }

    function onPointerEnd(e) {
      if (!finePointer || !tracking) return;
      if (e.pointerId !== pointerId) return;

      if (dragging) suppressClick = true;
      resetDragState();
    }

    function onClickCapture(e) {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    }

    function onDragStart(e) {
      e.preventDefault();
    }

    function bindFinePointerHandlers() {
      row.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerEnd);
      document.addEventListener('pointercancel', onPointerEnd);
    }

    function unbindFinePointerHandlers() {
      row.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerEnd);
      document.removeEventListener('pointercancel', onPointerEnd);
      resetDragState();
    }

    const onMqChange = (e) => {
      if (e.matches && !finePointer) {
        finePointer = true;
        bindFinePointerHandlers();
      } else if (!e.matches && finePointer) {
        finePointer = false;
        unbindFinePointerHandlers();
      }
    };

    row.addEventListener('wheel', onWheel, { passive: false });
    if (finePointer) bindFinePointerHandlers();
    mq?.addEventListener('change', onMqChange);
    row.addEventListener('click', onClickCapture, true);
    row.addEventListener('dragstart', onDragStart);

    return () => {
      mq?.removeEventListener('change', onMqChange);
      row.removeEventListener('wheel', onWheel);
      unbindFinePointerHandlers();
      row.removeEventListener('click', onClickCapture, true);
      row.removeEventListener('dragstart', onDragStart);
      resetDragState();
    };
  }, [rowRef, active]);
}
