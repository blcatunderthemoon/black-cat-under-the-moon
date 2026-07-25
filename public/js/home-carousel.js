/**
 * Home focus carousel — scroll-snap + focus state + gatherings open count.
 */
(function (global) {
  var DEFAULT_INDEX = 2; /* Treehole */
  var root;
  var track;
  var slides;
  var dots;
  var activeIndex = DEFAULT_INDEX;
  var scrollRaf = 0;
  var suppressClickUntil = 0;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function slideCenterOffset(slide) {
    return slide.offsetLeft + slide.offsetWidth / 2;
  }

  function nearestIndex() {
    if (!track || !slides.length) return DEFAULT_INDEX;
    var mid = track.scrollLeft + track.clientWidth / 2;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var d = Math.abs(slideCenterOffset(slides[i]) - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function updateFocus(index, opts) {
    opts = opts || {};
    activeIndex = clamp(index, 0, slides.length - 1);
    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      var dist = Math.abs(i - activeIndex);
      slide.classList.toggle('is-active', i === activeIndex);
      slide.classList.toggle('is-near', dist === 1);
      if (i === activeIndex) {
        slide.setAttribute('aria-current', 'true');
        slide.tabIndex = 0;
      } else {
        slide.removeAttribute('aria-current');
        slide.tabIndex = -1;
      }
    }
    if (dots) {
      for (var d = 0; d < dots.length; d++) {
        if (d === activeIndex) dots[d].setAttribute('aria-current', 'true');
        else dots[d].removeAttribute('aria-current');
      }
    }
    if (opts.announce && root) {
      var label = slides[activeIndex].getAttribute('data-label') || '';
      root.setAttribute('aria-label', '模式導覽，目前：' + label);
    }
    syncArrows();
  }

  function scrollToIndex(index, behavior) {
    index = clamp(index, 0, slides.length - 1);
    var slide = slides[index];
    if (!slide || !track) return;
    var target = Math.max(0, slideCenterOffset(slide) - track.clientWidth / 2);
    if (behavior === 'auto' || behavior === 'instant') {
      cancelSettle();
      track.scrollLeft = target;
    } else {
      animateScrollTo(target);
    }
    updateFocus(index, { announce: true });
  }

  var settleRaf = 0;

  function cancelSettle() {
    if (settleRaf) {
      global.cancelAnimationFrame(settleRaf);
      settleRaf = 0;
    }
    if (track) track.classList.remove('is-settling');
  }

  /** Eased settle — smoother than native scrollTo(smooth) + snap fighting on mobile */
  function animateScrollTo(target) {
    cancelSettle();
    var start = track.scrollLeft;
    var dist = target - start;
    if (Math.abs(dist) < 1.5) {
      track.scrollLeft = target;
      return;
    }
    var duration = Math.min(420, Math.max(240, Math.abs(dist) * 0.62));
    var t0 = global.performance && performance.now ? performance.now() : Date.now();
    track.classList.add('is-settling');

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      var t = Math.min(1, (now - t0) / duration);
      track.scrollLeft = start + dist * easeOutCubic(t);
      if (t < 1) {
        settleRaf = global.requestAnimationFrame(frame);
      } else {
        settleRaf = 0;
        track.scrollLeft = target;
        track.classList.remove('is-settling');
      }
    }
    settleRaf = global.requestAnimationFrame(frame);
  }

  function onScroll() {
    if (scrollRaf) return;
    if (track && track.classList.contains('is-settling')) return;
    if (track && track.classList.contains('is-dragging')) return;
    scrollRaf = requestAnimationFrame(function () {
      scrollRaf = 0;
      updateFocus(nearestIndex());
    });
  }

  function onSlideActivate(e, index) {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      return;
    }
    if (index !== activeIndex) {
      e.preventDefault();
      scrollToIndex(index, 'smooth');
      return;
    }
    /* Active slide: let the <a> navigate normally */
  }

  function bindSlides() {
    slides.forEach(function (slide, index) {
      slide.addEventListener('click', function (e) {
        onSlideActivate(e, index);
      });
      slide.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if (index !== activeIndex) {
            e.preventDefault();
            scrollToIndex(index, 'smooth');
          }
        }
      });
    });
  }

  function bindDots() {
    if (!dots) return;
    dots.forEach(function (dot, index) {
      dot.addEventListener('click', function () {
        scrollToIndex(index, 'smooth');
      });
    });
  }

  function bindArrows() {
    if (!root) return;
    var prev = root.querySelector('.home-carousel__arrow--prev');
    var next = root.querySelector('.home-carousel__arrow--next');
    if (prev) {
      prev.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        scrollToIndex(activeIndex - 1, 'smooth');
      });
    }
    if (next) {
      next.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        scrollToIndex(activeIndex + 1, 'smooth');
      });
    }
  }

  function syncArrows() {
    if (!root) return;
    var prev = root.querySelector('.home-carousel__arrow--prev');
    var next = root.querySelector('.home-carousel__arrow--next');
    if (prev) prev.disabled = activeIndex <= 0;
    if (next) next.disabled = activeIndex >= slides.length - 1;
  }

  function bindKeyboard() {
    if (!root) return;
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1, 'smooth');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1, 'smooth');
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToIndex(0, 'smooth');
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToIndex(slides.length - 1, 'smooth');
      }
    });
  }

  function bindPointerDrag() {
    if (!track) return;
    var pointerId = null;
    var startX = 0;
    var startY = 0;
    var startScroll = 0;
    var startIndex = 0;
    var lastX = 0;
    var lastT = 0;
    var velocityX = 0;
    var dragged = false;
    var downSlide = null;
    var listening = false;
    var DRAG_THRESHOLD = 6;
    /* Commit next/prev if swipe clears this fraction of slide width, or a flick */
    var COMMIT_RATIO = 0.14;
    var COMMIT_MIN_PX = 28;
    var COMMIT_MAX_PX = 72;
    var FLICK_VX = 0.28; /* px/ms — easier flick on touch */

    function clearDragClasses() {
      root.classList.remove('is-dragging');
      track.classList.remove('is-dragging');
    }

    function unbindWindow() {
      if (!listening) return;
      listening = false;
      global.removeEventListener('pointermove', onPointerMove);
      global.removeEventListener('pointerup', onPointerUp);
      global.removeEventListener('pointercancel', onPointerUp);
    }

    function commitIndexAfterDrag(endX) {
      var dx = endX - startX;
      var slide = slides[startIndex] || slides[activeIndex];
      var slideW = slide ? slide.offsetWidth : track.clientWidth * 0.6;
      var commitPx = clamp(slideW * COMMIT_RATIO, COMMIT_MIN_PX, COMMIT_MAX_PX);
      var next = startIndex;
      /* Finger left → next card; finger right → previous (same as native carousels) */
      if (dx <= -commitPx || velocityX <= -FLICK_VX) next = startIndex + 1;
      else if (dx >= commitPx || velocityX >= FLICK_VX) next = startIndex - 1;
      return clamp(next, 0, slides.length - 1);
    }

    function onPointerMove(e) {
      if (pointerId === null || e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var now = e.timeStamp || Date.now();
      var dt = now - lastT;
      if (dt > 0 && dt < 64) {
        var instant = (e.clientX - lastX) / dt;
        /* Smooth velocity so release doesn't feel twitchy */
        velocityX = velocityX * 0.55 + instant * 0.45;
      }
      lastX = e.clientX;
      lastT = now;

      if (!dragged) {
        var adx = Math.abs(dx);
        var ady = Math.abs(dy);
        if (ady > adx && ady >= DRAG_THRESHOLD) {
          /* Vertical page scroll — abandon */
          unbindWindow();
          pointerId = null;
          downSlide = null;
          return;
        }
        if (adx < DRAG_THRESHOLD || adx < ady) return;
        dragged = true;
        root.classList.add('is-dragging');
        track.classList.add('is-dragging');
      }
      track.scrollLeft = startScroll - dx;
      e.preventDefault();
    }

    function onPointerUp(e) {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      var wasDrag = dragged;
      var slide = downSlide;
      var endX = e && typeof e.clientX === 'number' ? e.clientX : lastX;
      unbindWindow();
      clearDragClasses();
      pointerId = null;
      dragged = false;
      downSlide = null;

      if (wasDrag) {
        suppressClickUntil = Date.now() + 450;
        /* Direction + magnitude from drag start — same rule L/R; short swipe snaps home */
        scrollToIndex(commitIndexAfterDrag(endX), 'smooth');
        velocityX = 0;
        return;
      }

      /* Click previous / next card → focus that mode */
      if (slide) {
        var index = slides.indexOf(slide);
        if (index >= 0 && index !== activeIndex) {
          suppressClickUntil = Date.now() + 450;
          scrollToIndex(index, 'smooth');
        }
      }
      velocityX = 0;
    }

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.home-carousel__arrow')) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startScroll = track.scrollLeft;
      startIndex = nearestIndex();
      lastX = e.clientX;
      lastT = e.timeStamp || Date.now();
      velocityX = 0;
      dragged = false;
      cancelSettle();
      downSlide =
        e.target.closest && e.target.closest('.home-carousel__slide')
          ? e.target.closest('.home-carousel__slide')
          : null;
      if (!listening) {
        listening = true;
        global.addEventListener('pointermove', onPointerMove, { passive: false });
        global.addEventListener('pointerup', onPointerUp);
        global.addEventListener('pointercancel', onPointerUp);
      }
    });

    /* Stop native link/image drag from eating the gesture */
    track.addEventListener('dragstart', function (e) {
      e.preventDefault();
    });
  }

  function initialIndex() {
    if (global.location && global.location.hash === '#mode') return DEFAULT_INDEX;
    return DEFAULT_INDEX;
  }

  function fetchGatheringCount() {
    var meta = root && root.querySelector('[data-gathering-count]');
    if (!meta) return;
    meta.hidden = true;
    fetch('/api/gatherings?open_only=1&limit=40', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('gatherings ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var n = typeof data.total === 'number' ? data.total : (data.gatherings || []).length;
        if (typeof n !== 'number' || n < 0 || !isFinite(n)) n = 0;
        if (n <= 0) {
          meta.hidden = true;
          return;
        }
        meta.textContent = '進行中 (' + n + ')';
        meta.hidden = false;
      })
      .catch(function () {
        meta.hidden = true;
      });
  }

  function fetchDriftWeeklyCount() {
    var meta = root && root.querySelector('[data-drift-weekly]');
    if (!meta) return;
    meta.hidden = true;
    fetch('/api/public/bottle-stats', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('bottle-stats ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var n = data && typeof data.weekly_new === 'number' ? data.weekly_new : 0;
        if (!isFinite(n) || n <= 0) {
          meta.hidden = true;
          return;
        }
        meta.textContent = '🍾 等你拾起（' + Math.floor(n) + '）';
        meta.hidden = false;
      })
      .catch(function () {
        meta.hidden = true;
      });
  }

  function init() {
    root = document.getElementById('home-carousel');
    if (!root) return;
    track = root.querySelector('.home-carousel__track');
    slides = Array.prototype.slice.call(root.querySelectorAll('.home-carousel__slide'));
    dots = Array.prototype.slice.call(root.querySelectorAll('.home-carousel__dot'));
    if (!track || !slides.length) return;

    bindSlides();
    bindDots();
    bindArrows();
    bindKeyboard();
    bindPointerDrag();
    track.addEventListener('scroll', onScroll, { passive: true });
    global.addEventListener('resize', function () {
      scrollToIndex(activeIndex, 'auto');
    });

    var start = initialIndex();
    track.classList.add('is-booting');
    updateFocus(start, { announce: false });
    /* Instant jump to Treehole before first paint — no scroll animation */
    scrollToIndex(start, 'auto');
    requestAnimationFrame(function () {
      scrollToIndex(start, 'auto');
      track.classList.remove('is-booting');
      updateFocus(start, { announce: true });
    });

    fetchGatheringCount();
    fetchDriftWeeklyCount();

    if (global.MobileDocumentScroll) {
      if (MobileDocumentScroll.setLandingScrollScreen) {
        MobileDocumentScroll.setLandingScrollScreen('home');
      }
      if (MobileDocumentScroll.refreshLandingScrollExtent) {
        MobileDocumentScroll.refreshLandingScrollExtent();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.HomeCarousel = {
    scrollToIndex: function (i) {
      scrollToIndex(i, 'smooth');
    },
    getActiveIndex: function () {
      return activeIndex;
    },
  };
})(typeof window !== 'undefined' ? window : this);
