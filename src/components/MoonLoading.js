import { useEffect, useState } from 'react';
import {
  MOON_LOADING_FRAMES,
  MOON_LOADING_FRAME_INTERVAL_MS,
} from '../lib/moon-loading-frames.js';

export default function MoonLoading({
  label,
  className = '',
  size = 28,
  centered = true,
  theme = 'night',
  variant = 'inline',
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frameSrc = MOON_LOADING_FRAMES[frameIndex];

  useEffect(() => {
    MOON_LOADING_FRAMES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrameIndex((index) => (index + 1) % MOON_LOADING_FRAMES.length);
    }, MOON_LOADING_FRAME_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const rootClass = [
    'moon-loading',
    theme === 'forum' ? 'moon-loading--forum' : 'moon-loading--night',
    variant === 'hero' ? 'moon-loading--hero' : '',
    centered ? 'moon-loading--centered' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <img
        className="moon-loading__img"
        src={frameSrc}
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable={false}
      />
      {label ? <p className="moon-loading__label pixel-muted">{label}</p> : null}
    </div>
  );
}
