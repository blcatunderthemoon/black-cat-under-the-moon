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

/** Furniture slots — one equipped item per slot. */
export const ROOM_SLOTS = {
  bowl: { id: 'bowl', nameZh: '貓兜', order: 1 },
  window: { id: 'window', nameZh: '窗外景', order: 2 },
  bed: { id: 'bed', nameZh: '貓窩', order: 3 },
};

/**
 * Static catalog — shard costs & CSS render hooks.
 * `preview` maps to a `.my-cat-furni__preview--{preview}` class for the shop
 * thumbnail; scene rendering keys off the equipped id per slot.
 */
export const ROOM_ITEMS = {
  bowl_basic: {
    id: 'bowl_basic',
    slot: 'bowl',
    nameZh: '陶碗',
    descZh: '樸實嘅陶土飯碗，起手就有。',
    shardCost: 0,
    layer: 'base',
    preview: 'bowl-basic',
  },
  bowl_moon: {
    id: 'bowl_moon',
    slot: 'bowl',
    nameZh: '月光瓷碗',
    descZh: '冷藍釉色，餵食時泛淡淡月光。',
    shardCost: 40,
    layer: 'base',
    preview: 'bowl-moon',
  },
  window_default: {
    id: 'window_default',
    slot: 'window',
    nameZh: '滿月窗',
    descZh: '一輪滿月同幾粒閃爍星。',
    shardCost: 0,
    layer: 'fx',
    preview: 'window-default',
  },
  window_galaxy: {
    id: 'window_galaxy',
    slot: 'window',
    nameZh: '銀河窗',
    descZh: '紫粉銀河喺窗外緩緩流轉。',
    shardCost: 55,
    layer: 'fx',
    preview: 'window-galaxy',
  },
  window_meteor: {
    id: 'window_meteor',
    slot: 'window',
    nameZh: '流星窗',
    descZh: '夜空不時有流星劃過。',
    shardCost: 70,
    layer: 'fx',
    preview: 'window-meteor',
  },
  bed_box: {
    id: 'bed_box',
    slot: 'bed',
    nameZh: '紙皮箱窩',
    descZh: '免費起手窩，貓咪嘅安全感。',
    shardCost: 0,
    layer: 'base',
    preview: 'bed-box',
  },
};

export function getRoomItem(itemId) {
  return ROOM_ITEMS[itemId] || null;
}

export function getEquippedBowlId(equipped) {
  return equipped?.bowl || DEFAULT_ROOM_EQUIPPED.bowl;
}

export function getEquippedWindowId(equipped) {
  return equipped?.window || DEFAULT_ROOM_EQUIPPED.window;
}

/** Short variant token for the window scene class, e.g. 'galaxy'. */
export function getWindowVariant(windowId) {
  return String(windowId || DEFAULT_ROOM_EQUIPPED.window).replace(/^window_/, '');
}
