/**
 * Index landing — pixel black cat mascot.
 * Rare short visits: walk in → brief stay → walk off. Not always on screen.
 */
(function () {
  'use strict';

  /* ~12% chance on load; later retries even rarer */
  var APPEAR_CHANCE_FIRST = 0.12;
  var APPEAR_CHANCE_RETRY = 0.06;
  /* Visible on-screen window (ms) before exit starts */
  var STAY_MIN_MS = 4500;
  var STAY_MAX_MS = 8000;
  /* Delay before first appear attempt / between visits */
  var FIRST_DELAY_MIN_MS = 4000;
  var FIRST_DELAY_MAX_MS = 14000;
  var RETRY_DELAY_MIN_MS = 90000;
  var RETRY_DELAY_MAX_MS = 180000;

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
  var visitTimer = null;
  var retryTimer = null;
  var pos = { x: 0, y: 0 };
  var visiting = false;

  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function init() {
    var btn = document.getElementById('welcome-mascot');
    if (!btn) return;

    var pupils = btn.querySelectorAll('.welcome-mascot__pupil');
    var bubble = btn.querySelector('.welcome-mascot__bubble');
    var figure = btn.querySelector('.welcome-mascot__figure');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var walking = false;
    var margin = 36;
    var bottomPad = 64;
    var mobileMq = window.matchMedia('(max-width: 768px)');
    var exitSide = 'right';

    btn.hidden = true;

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

    function offscreenX(side) {
      var size = catSize();
      var halfW = size.w * 0.5;
      if (side === 'left') return -halfW - 24;
      return window.innerWidth + halfW + 24;
    }

    function onstageX() {
      var b = bounds();
      var span = Math.max(1, b.maxX - b.minX);
      return b.minX + span * (0.18 + Math.random() * 0.35);
    }

    function walkDuration(fromX, toX) {
      var dist = Math.abs(toX - fromX);
      return Math.min(2800, Math.max(900, Math.round(dist * 14)));
    }

    function hideBubble() {
      if (!bubble) return;
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubbleTimer = null;
      bubble.classList.remove('welcome-mascot__bubble--visible', 'welcome-mascot__bubble--edge-left', 'welcome-mascot__bubble--edge-right');
      bubble.hidden = true;
    }

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

    function pickLine() {
      if (MEOW_LINES.length <= 1) return MEOW_LINES[0] || '喵~';
      var idx;
      do {
        idx = Math.floor(Math.random() * MEOW_LINES.length);
      } while (idx === lastLineIndex);
      lastLineIndex = idx;
      return MEOW_LINES[idx];
    }

    function maybeMeow() {
      if (!bubble || Math.random() > 0.45) return;
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
        }, 240);
      }, 1800);
    }

    function finishVisit() {
      visiting = false;
      walking = false;
      hideBubble();
      btn.classList.remove('welcome-mascot--walk', 'welcome-mascot--tail', 'welcome-mascot--blink', 'welcome-mascot--moon', 'welcome-mascot--sparkle', 'welcome-mascot--whiskers');
      btn.hidden = true;
      btn.style.transitionDuration = '0ms';
      scheduleRetry();
    }

    function exitVisit() {
      if (!visiting || btn.hidden) return;
      hideBubble();
      var leaveX = offscreenX(exitSide);
      btn.classList.toggle('welcome-mascot--face-left', leaveX < pos.x - 4);
      var durationMs = reducedMotion ? 0 : walkDuration(pos.x, leaveX);

      function afterExit() {
        finishVisit();
      }

      if (reducedMotion || durationMs <= 0) {
        pos.x = leaveX;
        applyPos(false);
        afterExit();
        return;
      }

      requestAnimationFrame(function () {
        pos.x = leaveX;
        applyPos(true, durationMs);
        if (visitTimer) clearTimeout(visitTimer);
        visitTimer = setTimeout(afterExit, durationMs + 80);
      });
    }

    function beginVisit() {
      if (visiting) return;
      visiting = true;
      exitSide = Math.random() < 0.5 ? 'left' : 'right';
      var enterSide = exitSide === 'left' ? 'right' : 'left';
      var b = bounds();
      var targetX = onstageX();
      var startX = offscreenX(enterSide);

      pos.x = startX;
      pos.y = b.feetY;
      btn.hidden = false;
      btn.classList.toggle('welcome-mascot--face-left', targetX < startX - 4);
      applyPos(false);

      var enterMs = reducedMotion ? 0 : walkDuration(startX, targetX);

      function onStage() {
        walking = false;
        btn.classList.remove('welcome-mascot--walk');
        maybeMeow();
        if (visitTimer) clearTimeout(visitTimer);
        visitTimer = setTimeout(exitVisit, randBetween(STAY_MIN_MS, STAY_MAX_MS));
      }

      if (reducedMotion || enterMs <= 0) {
        pos.x = targetX;
        applyPos(false);
        onStage();
        return;
      }

      requestAnimationFrame(function () {
        pos.x = targetX;
        pos.y = b.feetY;
        applyPos(true, enterMs);
        if (visitTimer) clearTimeout(visitTimer);
        visitTimer = setTimeout(onStage, enterMs + 60);
      });
    }

    function tryAppear(chance) {
      if (visiting) return;
      if (document.hidden) {
        scheduleRetry();
        return;
      }
      if (Math.random() < chance) {
        beginVisit();
      } else {
        scheduleRetry();
      }
    }

    function scheduleRetry() {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(function () {
        tryAppear(APPEAR_CHANCE_RETRY);
      }, randBetween(RETRY_DELAY_MIN_MS, RETRY_DELAY_MAX_MS));
    }

    function scheduleFirst() {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(function () {
        tryAppear(APPEAR_CHANCE_FIRST);
      }, randBetween(FIRST_DELAY_MIN_MS, FIRST_DELAY_MAX_MS));
    }

    btn.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'transform') return;
      if (!btn.classList.contains('welcome-mascot--walk')) return;
      btn.classList.remove('welcome-mascot--walk');
      walking = false;
    });

    function setPupilLook(dx, dy) {
      if (btn.hidden || walking) return;
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

    window.addEventListener('mousemove', function (e) {
      if (btn.hidden || walking) return;
      var rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width * 0.5;
      var cy = rect.top + rect.height * 0.42;
      setPupilLook(e.clientX - cx, e.clientY - cy);
    }, { passive: true });

    btn.addEventListener('click', function () {
      if (btn.hidden || !bubble) return;
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
        }, 240);
      }, 1600);
    });

    window.addEventListener('resize', function () {
      if (btn.hidden || visiting) return;
      if (bubble && !bubble.hidden) alignBubble();
    }, { passive: true });

    scheduleFirst();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
