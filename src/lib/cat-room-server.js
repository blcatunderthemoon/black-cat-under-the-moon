/**
 * My Cat room — server helpers (Phase 3).
 * SERVER ONLY.
 */

import {
  DEFAULT_ROOM_EQUIPPED,
  DEFAULT_ROOM_OWNED,
  ROOM_ITEMS,
  getEquippedBowlId,
  getEquippedWindowId,
} from './cat-room.js';

const FALLBACK_ROOM = {
  equipped: { ...DEFAULT_ROOM_EQUIPPED },
  owned_items: [...DEFAULT_ROOM_OWNED],
};

/** Fetch or create the user's room row; falls back if table not migrated yet. */
export async function ensureUserCatRoom(admin, userId) {
  try {
    const { data: existing, error } = await admin
      .from('user_cat_room')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      if (error.code === '42P01') return FALLBACK_ROOM;
      throw error;
    }
    if (existing) return existing;

    const { data: created, error: insertError } = await admin
      .from('user_cat_room')
      .insert({
        user_id: userId,
        equipped: DEFAULT_ROOM_EQUIPPED,
        owned_items: DEFAULT_ROOM_OWNED,
      })
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505' || insertError.code === '42P01') {
        const { data: raced } = await admin
          .from('user_cat_room')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (raced) return raced;
        return FALLBACK_ROOM;
      }
      throw insertError;
    }
    return created;
  } catch (err) {
    if (err?.code === '42P01') return FALLBACK_ROOM;
    console.warn('[cat-room] ensureUserCatRoom fallback:', err?.message || err);
    return FALLBACK_ROOM;
  }
}

/** True when ensureUserCatRoom returned the un-persisted fallback (table missing). */
export function isFallbackRoom(roomRow) {
  return !roomRow?.user_id;
}

/** Upsert a patch onto the user's room row (equipped / owned_items). */
export async function upsertUserCatRoom(admin, userId, patch) {
  const { data, error } = await admin
    .from('user_cat_room')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Room payload for GET /api/my-cat. */
export function buildRoomView(roomRow) {
  const equipped = { ...DEFAULT_ROOM_EQUIPPED, ...(roomRow?.equipped || {}) };
  const owned = roomRow?.owned_items?.length
    ? roomRow.owned_items
    : [...DEFAULT_ROOM_OWNED];

  return {
    equipped,
    owned_items: owned,
    bowl_id: getEquippedBowlId(equipped),
    window_id: getEquippedWindowId(equipped),
    items: Object.values(ROOM_ITEMS).map((item) => ({
      ...item,
      owned: owned.includes(item.id),
      equipped: equipped[item.slot] === item.id,
    })),
  };
}
