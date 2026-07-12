/**
 * My Cat room furniture — Phase 3 (§12, docs/MY-CAT-GAME-DESIGN.md).
 * Client-safe item catalog + defaults.
 */

/** Default equipped furniture for new users. */
export const DEFAULT_ROOM_EQUIPPED = {
  bowl: 'bowl_basic',
  bed: 'bed_box',
  window: 'window_default',
};

/** Default owned items (free starter set). */
export const DEFAULT_ROOM_OWNED = ['bowl_basic', 'bed_box', 'window_default'];

/** Static catalog — shard costs & unlock rules; purchases wired in Phase 3.2. */
export const ROOM_ITEMS = {
  bowl_basic: {
    id: 'bowl_basic',
    slot: 'bowl',
    nameZh: '陶碗',
    shardCost: 0,
    layer: 'base',
  },
  bowl_moon: {
    id: 'bowl_moon',
    slot: 'bowl',
    nameZh: '月光瓷碗',
    shardCost: 40,
    layer: 'base',
  },
  bed_box: {
    id: 'bed_box',
    slot: 'bed',
    nameZh: '紙皮箱窩',
    shardCost: 0,
    layer: 'base',
  },
  window_default: {
    id: 'window_default',
    slot: 'window',
    nameZh: '滿月窗',
    shardCost: 0,
    layer: 'fx',
  },
};

export function getRoomItem(itemId) {
  return ROOM_ITEMS[itemId] || null;
}

export function getEquippedBowlId(equipped) {
  return equipped?.bowl || DEFAULT_ROOM_EQUIPPED.bowl;
}
