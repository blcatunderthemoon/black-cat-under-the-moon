/**
 * Pixel cat food bowl — appears on floor; food pops in while cat eats.
 * Phase 3 §12.3
 */

import { ForumSparkleIcon } from './UiIcons.js';

export default function CatRoomBowl({ bowlId = 'bowl_basic', isEating = false }) {
  const variant = bowlId === 'bowl_moon' ? 'moon' : 'basic';

  return (
    <div
      className={`my-cat-room__bowl my-cat-room__bowl--${variant}${isEating ? ' my-cat-room__bowl--eating' : ''}`}
      aria-hidden="true"
    >
      <span className="my-cat-room__bowl-rim" />
      <span className="my-cat-room__bowl-body" />
      <span className={`my-cat-room__bowl-food${isEating ? ' my-cat-room__bowl-food--visible' : ''}`}>
        <span className="my-cat-room__bowl-food-mound" />
      </span>
      {isEating && (
        <span className="my-cat-room__bowl-sparkles" aria-hidden="true">
          <span className="my-cat-room__bowl-spark my-cat-room__bowl-spark--1">
            <ForumSparkleIcon size={10} />
          </span>
          <span className="my-cat-room__bowl-spark my-cat-room__bowl-spark--2">
            <ForumSparkleIcon size={10} />
          </span>
        </span>
      )}
    </div>
  );
}
