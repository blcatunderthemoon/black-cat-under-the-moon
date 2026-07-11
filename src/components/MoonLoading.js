import { useEffect, useRef } from 'react';

import {
  MOON_LOADING_FRAMES,
  MOON_LOADING_FRAME_INTERVAL_MS,
  MOON_LOADING_SMOOTH_FRAME_INTERVAL_MS,
} from '../lib/moon-loading-frames.js';
import { LOADING_LABEL, splitLoadingLabel } from '../lib/loading-label.js';

function applyMask(el, src) {
  if (!el || !src) return;
  el.style.setProperty('--moon-mask-url', `url('${src}')`);
}

export default function MoonLoading({
  label = LOADING_LABEL,
  className = '',
  size = 48,
  centered = true,
  theme: _theme,
  variant = 'inline',
  /** Crossfade between moon phases instead of instant frame swaps. */
  smooth = false,
}) {
  const moonRef = useRef(null);
  const layerARef = useRef(null);
  const layerBRef = useRef(null);
  const activeLayerRef = useRef('a');
  const framesReadyRef = useRef(false);

  const moonSize = variant === 'hero' ? 72 : size;
  const initialFrame = MOON_LOADING_FRAMES[0];

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      MOON_LOADING_FRAMES.map((src) => {
        const img = new Image();
        img.src = src;
        if (img.decode) {
          return img.decode().catch(() => {}).then(() => src);
        }
        return new Promise((resolve) => {
          img.onload = () => resolve(src);
          img.onerror = () => resolve(src);
        });
      }),
    ).then(() => {
      if (cancelled) return;
      framesReadyRef.current = true;
      applyMask(layerARef.current, initialFrame);
      applyMask(layerBRef.current, initialFrame);
    });

    return () => { cancelled = true; };
  }, [initialFrame]);

  useEffect(() => {
    const intervalMs = smooth
      ? MOON_LOADING_SMOOTH_FRAME_INTERVAL_MS
      : MOON_LOADING_FRAME_INTERVAL_MS;

    // Derive the frame from a shared wall clock (not a per-instance counter) so every
    // MoonLoading mounted anywhere shows the exact same phase at the same moment,
    // regardless of when each one mounted. Same images + same change timing.
    let lastFrameIndex = -1;

    const tick = () => {
      if (!framesReadyRef.current) return;

      const frameIndex = Math.floor(Date.now() / intervalMs) % MOON_LOADING_FRAMES.length;
      if (frameIndex === lastFrameIndex) return;
      lastFrameIndex = frameIndex;

      const src = MOON_LOADING_FRAMES[frameIndex];
      const nextActive = activeLayerRef.current === 'a' ? 'b' : 'a';
      const nextLayer = nextActive === 'a' ? layerARef.current : layerBRef.current;
      const prevLayer = nextActive === 'a' ? layerBRef.current : layerARef.current;
      if (!nextLayer || !prevLayer) return;

      applyMask(nextLayer, src);
      nextLayer.style.opacity = '1';
      prevLayer.style.opacity = '0';
      activeLayerRef.current = nextActive;
    };

    // Poll faster than the frame interval so the shared-clock boundary is hit
    // promptly even for a late-mounting instance.
    const id = window.setInterval(tick, Math.max(60, Math.floor(intervalMs / 4)));
    tick();

    return () => window.clearInterval(id);
  }, [smooth]);

  const stackClass = [
    'loading-send-stack',
    centered ? 'loading-send-stack--centered' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const moonClass = [
    'moon-loading',
    'moon-loading--send',
    variant === 'hero' ? 'moon-loading--hero' : '',
    smooth ? 'moon-loading--smooth' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const moonStyle = {
    '--moon-mask-url': `url('${initialFrame}')`,
    '--moon-loading-size': `${moonSize}px`,
  };

  const { text: labelText, dots: labelDots } = splitLoadingLabel(label);

  return (
    <div className={stackClass} role="status" aria-live="polite">
      <div ref={moonRef} className={moonClass} style={moonStyle}>
        <div
          ref={layerARef}
          className="moon-loading__phase"
          style={{ '--moon-mask-url': `url('${initialFrame}')`, opacity: 1 }}
          aria-hidden="true"
        />
        <div
          ref={layerBRef}
          className="moon-loading__phase"
          style={{ '--moon-mask-url': `url('${initialFrame}')`, opacity: 0 }}
          aria-hidden="true"
        />
      </div>
      {label ? (
        <p className="moon-loading__label">
          {labelText}
          {labelDots ? <span className="loading-dots" aria-hidden="true" /> : null}
        </p>
      ) : null}
    </div>
  );
}
