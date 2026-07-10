(function () {
  var FRAMES = [
    '/loading/FirstQuarterloading.png',
    '/loading/WaxingGibbousloading.png',
    '/loading/fullmoonloading.png',
    '/loading/Waringloading.png',
  ];
  var INTERVAL_MS = 350;

  function preloadFrames() {
    FRAMES.forEach(function (src) {
      var img = new Image();
      img.src = src;
      if (img.decode) img.decode().catch(function () {});
    });
  }

  function applyMask(el, src) {
    if (!el || !src) return;
    el.style.setProperty('--moon-mask-url', 'url("' + src + '")');
  }

  function ensurePhaseLayers(el) {
    var existing = el.querySelectorAll('.moon-loading__phase');
    if (existing.length >= 2) {
      return { a: existing[0], b: existing[1] };
    }

    el.querySelectorAll('.moon-loading__img').forEach(function (node) {
      node.remove();
    });

    var a = document.createElement('div');
    a.className = 'moon-loading__phase';
    a.setAttribute('aria-hidden', 'true');
    a.style.opacity = '1';

    var b = document.createElement('div');
    b.className = 'moon-loading__phase';
    b.setAttribute('aria-hidden', 'true');
    b.style.opacity = '0';

    el.appendChild(a);
    el.appendChild(b);
    return { a: a, b: b };
  }

  function startMoonLoading(el) {
    if (el.dataset.moonLoadingInit === '1') return;
    el.dataset.moonLoadingInit = '1';

    el.classList.add('moon-loading--send');
    el.classList.remove('moon-loading--night', 'moon-loading--forum');

    if (!el.style.getPropertyValue('--moon-loading-size')) {
      var size = el.classList.contains('moon-loading--hero') ? '72px' : '48px';
      el.style.setProperty('--moon-loading-size', size);
    }

    var layers = ensurePhaseLayers(el);
    var frameIndex = 0;
    var active = 'a';
    var framesReady = false;

    Promise.all(FRAMES.map(function (src) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.src = src;
        if (img.decode) {
          img.decode().then(function () { resolve(src); }).catch(function () { resolve(src); });
          return;
        }
        img.onload = function () { resolve(src); };
        img.onerror = function () { resolve(src); };
      });
    })).then(function () {
      framesReady = true;
      applyMask(layers.a, FRAMES[0]);
      applyMask(layers.b, FRAMES[0]);
    });

    window.setInterval(function () {
      if (!framesReady) return;

      frameIndex = (frameIndex + 1) % FRAMES.length;
      var src = FRAMES[frameIndex];
      var nextActive = active === 'a' ? 'b' : 'a';
      var nextLayer = nextActive === 'a' ? layers.a : layers.b;
      var prevLayer = nextActive === 'a' ? layers.b : layers.a;

      applyMask(nextLayer, src);
      nextLayer.style.opacity = '1';
      prevLayer.style.opacity = '0';
      active = nextActive;
    }, INTERVAL_MS);
  }

  function initMoonLoading(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.moon-loading').forEach(startMoonLoading);
  }

  window.initMoonLoadingIn = initMoonLoading;

  window.MoonLoadingHtml = function MoonLoadingHtml(label, opts) {
    opts = opts || {};
    var hero = !!opts.hero;
    var size = hero ? 72 : (opts.size || 48);
    var src = FRAMES[0];
    var moonClass = 'moon-loading moon-loading--send' + (hero ? ' moon-loading--hero' : '');
    var displayLabel = label == null || label === '' ? '載入中...' : String(label);
    var labelMatch = displayLabel.match(/^(.*?)(…|\.{3})$/);
    var labelText = labelMatch ? labelMatch[1] : displayLabel;
    var labelDots = !!labelMatch;
    var html = '<div class="loading-send-stack loading-send-stack--centered">'
      + '<div class="' + moonClass + '" style="--moon-mask-url:url(\'' + src + '\');--moon-loading-size:' + size + 'px">'
      + '<div class="moon-loading__phase" style="--moon-mask-url:url(\'' + src + '\');opacity:1" aria-hidden="true"></div>'
      + '<div class="moon-loading__phase" style="--moon-mask-url:url(\'' + src + '\');opacity:0" aria-hidden="true"></div>'
      + '</div>';
    if (displayLabel) {
      html += '<p class="moon-loading__label">' + labelText
        + (labelDots ? '<span class="loading-dots" aria-hidden="true"></span>' : '')
        + '</p>';
    }
    html += '</div>';
    return html;
  };

  preloadFrames();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initMoonLoading(); });
  } else {
    initMoonLoading();
  }
})();
