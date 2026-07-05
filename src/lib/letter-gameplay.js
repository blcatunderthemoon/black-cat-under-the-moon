/**
 * Inbox letter gameplay — stamps, note styles, unlock rules.
 */

export const LETTER_STAMPS = [
  { id: 'cat_paw', emoji: '🐾', label: '貓爪', unlock: 'default' },
  { id: 'heart', emoji: '💜', label: '心意', unlock: 'premium' },
  { id: 'cry', emoji: '😿', label: '喊', unlock: 'premium' },
  { id: 'like', emoji: '👍', label: '讚', unlock: 'premium' },
  { id: 'moon', emoji: '🌙', label: '月印', unlock: 'premium' },
];

export const NOTE_COLORS = [
  { id: 'parchment', label: '淡黃', paper: '#e8d9a8', ink: '#221202', border: '#c9b87a' },
  { id: 'blush', label: '淡粉', paper: '#f0d4d8', ink: '#2a1018', border: '#d4a0a8' },
  { id: 'mist', label: '淡藍', paper: '#d4e4f0', ink: '#101a28', border: '#9cb8d0' },
  { id: 'sage', label: '淡綠', paper: '#d8ead4', ink: '#142210', border: '#9cb89c' },
];

export const NOTE_FONTS = [
  { id: 'zpix', label: '像素' },
  { id: 'hand', label: '手寫' },
  { id: 'retro', label: '復古' },
];

const STAMP_IDS = new Set(LETTER_STAMPS.map((s) => s.id));
const COLOR_IDS = new Set(NOTE_COLORS.map((c) => c.id));
const FONT_IDS = new Set(NOTE_FONTS.map((f) => f.id));

export const DEFAULT_LETTER_PREFS = {
  stamp_id: 'cat_paw',
  note_color: 'parchment',
  note_font: 'zpix',
  sound_enabled: true,
};

export function getStampById(id) {
  return LETTER_STAMPS.find((s) => s.id === id) || LETTER_STAMPS[0];
}

export function getNoteColorById(id) {
  return NOTE_COLORS.find((c) => c.id === id) || NOTE_COLORS[0];
}

export function getUnlockedStampIds() {
  return LETTER_STAMPS.map((s) => s.id);
}

export function normalizeLetterPrefs(raw, tier = 'free') {
  void tier;
  const unlocked = getUnlockedStampIds();
  const stampId = STAMP_IDS.has(raw?.stamp_id) ? raw.stamp_id : DEFAULT_LETTER_PREFS.stamp_id;
  const noteColor = COLOR_IDS.has(raw?.note_color) ? raw.note_color : DEFAULT_LETTER_PREFS.note_color;
  const noteFont = FONT_IDS.has(raw?.note_font) ? raw.note_font : DEFAULT_LETTER_PREFS.note_font;

  return {
    stamp_id: stampId,
    note_color: noteColor,
    note_font: noteFont,
    sound_enabled: raw?.sound_enabled !== false,
    unlocked_stamps: unlocked,
  };
}

export function validateLetterStyle(style) {
  const prefs = normalizeLetterPrefs(style || {});
  return {
    stamp_id: prefs.stamp_id,
    note_color: prefs.note_color,
    note_font: prefs.note_font,
  };
}

export function letterStyleFromMessage(msg) {
  const style = msg?.payload?.letter_style;
  if (!style || typeof style !== 'object') return null;
  return {
    stamp_id: STAMP_IDS.has(style.stamp_id) ? style.stamp_id : null,
    note_color: COLOR_IDS.has(style.note_color) ? style.note_color : 'parchment',
    note_font: FONT_IDS.has(style.note_font) ? style.note_font : 'zpix',
  };
}

export function notePaperClassName(noteColor = 'parchment', noteFont = 'zpix') {
  const color = COLOR_IDS.has(noteColor) ? noteColor : 'parchment';
  const font = FONT_IDS.has(noteFont) ? noteFont : 'zpix';
  return `note-paper--${color} note-font--${font}`;
}

export function moonPhaseEmoji(remaining, max) {
  if (remaining == null || max == null || max <= 0) return null;
  if (remaining <= 0) return '🌑';
  const ratio = remaining / max;
  if (ratio >= 0.85) return '🌕';
  if (ratio >= 0.65) return '🌖';
  if (ratio >= 0.45) return '🌗';
  if (ratio >= 0.25) return '🌘';
  return '🌑';
}
