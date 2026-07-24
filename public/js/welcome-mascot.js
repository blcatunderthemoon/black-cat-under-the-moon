/**
 * Index landing — pixel black cat mascot (bottom patrol + idle).
 */
(function () {
  'use strict';

  var MEOW_LINES = [
    '喵~',
    '今晚月色真係幾靚。',
    '呼~',
    '…你在找誰？',
    '月亮會記得每一個路過嘅人。',
    '慢慢嚟，夜仲好長。',
    '今晚啲星星特別多。',
    '我守緊呢度。',
    '有心事？掉個漂流瓶試下。',
    '今晚樹洞好靜。',
    '靈魂同頻，唔使急。',
    '伸個懶腰先…',
    '(ΦωΦ)',
    '唔使怕黑，仲有光。',
    '聽到風聲未？',
    '月光照到妳喇。',
    '想搵人傾下，就去圍爐。',
    '緣分有時會遲少少。',
    '黑貓唔咬人……應該啦。',
    '今晚好適合照照鏡。',
    'zzz…吓！',
    '尾巴自己郁嘅。',
  ];
  var lastLineIndex = -1;
  var bubbleTimer = null;
  var wanderTimer = null;
  var pos = { x: 0, y: 0 };

  function init() {
    var btn = document.getElementById('welcome-mascot');
    if (!btn) return;

    var pupils = btn.querySelectorAll('.welcome-mascot__pupil');
    var bubble = btn.querySelector('.welcome-mascot__bubble');
    var figure = btn.querySelector('.welcome-mascot__figure');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pauseUntil = 0;
    var walking = false;
    var margin = 36;
    var bottomPad = 64;
    var mobileMq = window.matchMedia('(max-width: 768px)');

    function isHomeLanding() {
      return !!document.getElementById('home-landing');
    }

    function isMobile() {
      return mobileMq.matches;
    }

    function catSize() {
      if (!figure) return { w: 48, h: 48 };
      var rect = figure.getBoundingClientRect();
      return { w: rect.width || 48, h: rect.height || 48 };
    }

    function bounds() {
      var size = catSize();
      var totalH = size.h;
      var halfW = size.w * 0.5;
      /* On home carousel, keep the cat in the bottom strip so it never sits on CTAs */
      var pad = isHomeLanding() ? (isMobile() ? 108 : 96) : bottomPad;
      var feetY = window.innerHeight - pad;
      var minX = margin + halfW;
      var maxX = Math.max(minX + 1, window.innerWidth - margin - halfW);
      var catTop = feetY - totalH;

      document.querySelectorAll('.site-footer--legal').forEach(function (footer) {
        var r = footer.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (r.bottom <= catTop + 4 || r.top >= feetY + 6) return;
        maxX = Math.min(maxX, Math.max(minX, r.left - halfW - 12));
      });

      var carousel = document.getElementById('home-carousel');
      if (carousel) {
        var cr = carousel.getBoundingClientRect();
        if (cr.width && cr.height && cr.bottom > catTop - 8 && cr.top < feetY + 20) {
          /* Prefer left side near presence chip */
          maxX = Math.min(maxX, Math.max(minX, cr.left + halfW + 8));
        }
      }

      if (isMobile()) {
        maxX = Math.min(maxX, window.innerWidth - margin - halfW - 56);
      }

      return {
        minX: minX,
        maxX: maxX,
        feetY: feetY,
        minFeetY: feetY - 12,
        maxFeetY: feetY,
        totalH: totalH,
        halfW: halfW,
      };
    }

    function resolveFooterOverlap() {
      var size = catSize();
      var halfW = size.w * 0.5;
      var h = size.h;
      document.querySelectorAll('.site-footer--legal').forEach(function (footer) {
        var r = footer.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var left = pos.x - halfW;
        var right = pos.x + halfW;
        var top = pos.y - h;
        var bottom = pos.y;
        if (right <= r.left + 4 || left >= r.right - 4 || bottom <= r.top + 4 || top >= r.bottom - 4) return;
        var liftY = r.top - 8;
        if (liftY < pos.y) pos.y = liftY;
        var slideX = r.left - halfW - 12;
        var b = bounds();
        if (slideX >= b.minX) pos.x = Math.min(pos.x, slideX);
      });
    }

    function clampPos() {
      var b = bounds();
      pos.x = Math.min(b.maxX, Math.max(b.minX, pos.x));
      pos.y = Math.min(b.maxFeetY, Math.max(b.minFeetY, pos.y));
      resolveFooterOverlap();
      b = bounds();
      pos.x = Math.min(b.maxX, Math.max(b.minX, pos.x));
      pos.y = Math.min(b.maxFeetY, Math.max(b.minFeetY, pos.y));
    }

    function applyPos(animate, durationMs) {
      var b = bounds();
      btn.style.setProperty('--mascot-x', (pos.x - b.halfW) + 'px');
      btn.style.setProperty('--mascot-y', (pos.y - b.totalH) + 'px');

      if (animate && durationMs > 0) {
        btn.style.transitionDuration = durationMs + 'ms';
        btn.classList.add('welcome-mascot--walk');
        walking = true;
      } else {
        btn.style.transitionDuration = '0ms';
        btn.classList.remove('welcome-mascot--walk');
        walking = false;
      }
    }

    function setStartPos() {
      var b = bounds();
      if (isHomeLanding()) {
        pos.x = b.minX + Math.min(48, (b.maxX - b.minX) * 0.35);
      } else {
        pos.x = b.minX + (b.maxX - b.minX) * (isMobile() ? 0.22 : 0.78);
      }
      pos.y = b.feetY;
      clampPos();
      applyPos(false);
    }

    setStartPos();

    function pickHop() {
      var b = bounds();
      var hop = 28 + Math.random() * 44;
      var dir = Math.random() < 0.5 ? -1 : 1;
      var nextX = pos.x + dir * hop;

      if (nextX < b.minX || nextX > b.maxX) {
        nextX = pos.x - dir * hop;
      }
      nextX = Math.min(b.maxX, Math.max(b.minX, nextX));

      if (Math.abs(nextX - pos.x) < 24) {
        return null;
      }

      return {
        x: nextX,
        y: b.feetY - Math.floor(Math.random() * 4),
      };
    }

    function wanderDuration(from, to) {
      var dx = Math.abs(to.x - from.x);
      var dy = Math.abs(to.y - from.y);
      var dist = Math.sqrt(dx * dx + dy * dy);
      return Math.min(3200, Math.max(1000, Math.round(dist * 22)));
    }

    function wander() {
      if (reducedMotion) return;
      if (walking) return;
      if (Date.now() < pauseUntil) return;
      if (bubble && bubble.classList.contains('welcome-mascot__bubble--visible')) return;

      var next = pickHop();
      if (!next) return;

      var durationMs = wanderDuration(pos, next);
      btn.classList.toggle('welcome-mascot--face-left', next.x < pos.x - 4);

      btn.style.transitionDuration = '0ms';
      btn.classList.remove('welcome-mascot--walk');
      applyPos(false);

      requestAnimationFrame(function () {
        pos.x = next.x;
        pos.y = next.y;
        applyPos(true, durationMs);
      });
    }

    btn.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'transform') return;
      if (!btn.classList.contains('welcome-mascot--walk')) return;
      btn.classList.remove('welcome-mascot--walk');
      walking = false;
    });

    function scheduleWander(delay) {
      if (wanderTimer) clearTimeout(wanderTimer);
      wanderTimer = setTimeout(function () {
        wander();
        scheduleWander(14000 + Math.random() * 9000);
      }, delay);
    }

    if (!reducedMotion) {
      scheduleWander(12000 + Math.random() * 6000);
    }

    function onLayoutChange() {
      clampPos();
      applyPos(false);
    }

    window.addEventListener('resize', onLayoutChange, { passive: true });
    window.addEventListener('scroll', onLayoutChange, { passive: true });

    btn.addEventListener('mouseenter', function () {
      pauseUntil = Date.now() + 5000;
    });

    function alignBubble() {
      if (!bubble || bubble.hidden) return;
      bubble.classList.remove('welcome-mascot__bubble--edge-left', 'welcome-mascot__bubble--edge-right');
      var rect = bubble.getBoundingClientRect();
      if (rect.left < 8) {
        bubble.classList.add('welcome-mascot__bubble--edge-left');
      } else if (rect.right > window.innerWidth - 8) {
        bubble.classList.add('welcome-mascot__bubble--edge-right');
      }
    }

    function randomIdle() {
      if (reducedMotion) return;
      if (walking) return;
      var roll = Math.random();
      btn.classList.remove('welcome-mascot--tail', 'welcome-mascot--blink', 'welcome-mascot--moon', 'welcome-mascot--sparkle', 'welcome-mascot--whiskers');
      if (roll < 0.18) {
        btn.classList.add('welcome-mascot--tail');
        setTimeout(function () { btn.classList.remove('welcome-mascot--tail'); }, 1400);
      } else if (roll < 0.42) {
        btn.classList.add('welcome-mascot--blink');
        setTimeout(function () { btn.classList.remove('welcome-mascot--blink'); }, 180);
      } else if (roll < 0.58) {
        btn.classList.add('welcome-mascot--moon');
        setTimeout(function () { btn.classList.remove('welcome-mascot--moon'); }, 2200);
      } else if (roll < 0.74) {
        btn.classList.add('welcome-mascot--sparkle');
        setTimeout(function () { btn.classList.remove('welcome-mascot--sparkle'); }, 900);
      } else if (roll < 0.88) {
        btn.classList.add('welcome-mascot--whiskers');
        setTimeout(function () { btn.classList.remove('welcome-mascot--whiskers'); }, 400);
      }
    }

    if (!reducedMotion) {
      setInterval(randomIdle, 9000 + Math.random() * 7000);
      setTimeout(randomIdle, 6000 + Math.random() * 4000);
    }

    function setPupilLook(dx, dy) {
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var max = 1;
      var nx = (dx / len) * max;
      var ny = (dy / len) * max;
      var faceLeft = btn.classList.contains('welcome-mascot--face-left');
      if (faceLeft) nx = -nx;
      pupils.forEach(function (p) {
        p.style.setProperty('--pupil-x', nx + 'px');
        p.style.setProperty('--pupil-y', ny + 'px');
        p.style.transform = 'translate(' + nx + 'px,' + ny + 'px)';
      });
    }

    function onPointerMove(e) {
      if (walking) return;
      var rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width * 0.5;
      var cy = rect.top + rect.height * 0.42;
      setPupilLook(e.clientX - cx, e.clientY - cy);
      btn.classList.remove('welcome-mascot--moon');
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true });

    function pickLine() {
      if (MEOW_LINES.length <= 1) return MEOW_LINES[0] || '喵~';
      var idx;
      do {
        idx = Math.floor(Math.random() * MEOW_LINES.length);
      } while (idx === lastLineIndex);
      lastLineIndex = idx;
      return MEOW_LINES[idx];
    }

    btn.addEventListener('click', function () {
      if (!bubble) return;
      pauseUntil = Date.now() + 4000;
      bubble.textContent = pickLine();
      bubble.hidden = false;
      bubble.classList.remove('welcome-mascot__bubble--edge-left', 'welcome-mascot__bubble--edge-right');
      bubble.classList.add('welcome-mascot__bubble--visible');
      requestAnimationFrame(function () {
        alignBubble();
        requestAnimationFrame(alignBubble);
      });
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(function () {
        bubble.classList.remove('welcome-mascot__bubble--visible');
        bubbleTimer = setTimeout(function () {
          bubble.hidden = true;
          bubble.classList.remove('welcome-mascot__bubble--edge-left', 'welcome-mascot__bubble--edge-right');
        }, 280);
      }, 2600);
    });

    window.addEventListener('resize', function () {
      if (bubble && !bubble.hidden) alignBubble();
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
