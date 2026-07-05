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
    });
  }

  function startMoonLoading(el) {
    if (el.dataset.moonLoadingInit === '1') return;
    el.dataset.moonLoadingInit = '1';

    var img = el.querySelector('.moon-loading__img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'moon-loading__img';
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.width = el.classList.contains('moon-loading--hero') ? 44 : 28;
      img.height = img.width;
      el.appendChild(img);
    }

    var frameIndex = 0;
    img.src = FRAMES[frameIndex];

    window.setInterval(function () {
      frameIndex = (frameIndex + 1) % FRAMES.length;
      img.src = FRAMES[frameIndex];
    }, INTERVAL_MS);
  }

  function initMoonLoading() {
    document.querySelectorAll('.moon-loading').forEach(startMoonLoading);
  }

  preloadFrames();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoonLoading);
  } else {
    initMoonLoading();
  }
})();
