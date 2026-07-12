/**
 * CatSprite — renders one cat animation from its spritesheet strip.
 * Uses CSS steps() so we control playback speed (the source GIFs are
 * locked at 8/12fps, which felt too fast). Animation switching is
 * driven by the parent (MyCatPanel).
 */

import { getCatStripUrl, getCatAnimMeta, DEFAULT_SKIN_ID } from '../lib/my-cat.js';

export default function CatSprite({
  skinId = DEFAULT_SKIN_ID,
  anim = 'idle_slowblink',
  size = 160,
  className = '',
  alt = '我的月光貓',
  paused = false,
}) {
  const { frames, fps } = getCatAnimMeta(anim);
  const stripUrl = getCatStripUrl(skinId, anim);

  return (
    <span
      role="img"
      aria-label={alt}
      className={`cat-sprite cat-sprite--strip${className ? ` ${className}` : ''}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${stripUrl})`,
        backgroundSize: `${frames * size}px ${size}px`,
        animationDuration: `${(frames / fps).toFixed(3)}s`,
        animationTimingFunction: `steps(${frames})`,
        // 靜止時完全停播（背景回到第 0 幀企定姿勢），避免 pause 卡喺半格
        ...(paused ? { animationName: 'none' } : {}),
        '--cat-strip-end': `${-frames * size}px`,
      }}
    />
  );
}
