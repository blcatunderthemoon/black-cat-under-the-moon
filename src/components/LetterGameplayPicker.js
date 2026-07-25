import {
  LETTER_STAMPS,
  NOTE_COLORS,
  NOTE_FONTS,
  getStampById,
} from '../lib/letter-gameplay.js';

export default function LetterGameplayPicker({
  prefs,
  onChange,
  compact = false,
  disabled = false,
}) {
  function pickStamp(id) {
    if (disabled) return;
    onChange?.({ ...prefs, stamp_id: id });
  }

  function pickColor(id) {
    if (disabled) return;
    onChange?.({ ...prefs, note_color: id });
  }

  function pickFont(id) {
    if (disabled) return;
    onChange?.({ ...prefs, note_font: id });
  }

  function toggleSound() {
    if (disabled) return;
    onChange?.({ ...prefs, sound_enabled: !prefs.sound_enabled });
  }

  const selectedStamp = getStampById(prefs?.stamp_id);

  return (
    <div className={`letter-gameplay-picker${compact ? ' letter-gameplay-picker--compact' : ''}`}>
      <div className="letter-gameplay-picker__row">
        <span className="letter-gameplay-picker__label">印章</span>
        <div className="letter-gameplay-picker__chips" role="listbox" aria-label="選擇印章">
          {LETTER_STAMPS.map((stamp) => {
            const active = prefs?.stamp_id === stamp.id;
            return (
              <button
                key={stamp.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={disabled}
                title={stamp.label}
                className={`letter-gameplay-picker__chip letter-gameplay-picker__chip--stamp${active ? ' letter-gameplay-picker__chip--active' : ''}`}
                onClick={() => pickStamp(stamp.id)}
              >
                <span aria-hidden="true">{stamp.emoji}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="letter-gameplay-picker__row">
        <span className="letter-gameplay-picker__label">紙色</span>
        <div className="letter-gameplay-picker__chips" role="listbox" aria-label="選擇便利貼顏色">
          {NOTE_COLORS.map((color) => {
            const active = prefs?.note_color === color.id;
            return (
              <button
                key={color.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={disabled}
                title={color.label}
                className={`letter-gameplay-picker__chip letter-gameplay-picker__chip--color${active ? ' letter-gameplay-picker__chip--active' : ''}`}
                style={{ '--chip-paper': color.paper, '--chip-ink': color.ink }}
                onClick={() => pickColor(color.id)}
              >
                <span className="letter-gameplay-picker__swatch" aria-hidden="true" />
                {!compact && <span className="letter-gameplay-picker__chip-text">{color.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="letter-gameplay-picker__row">
        <span className="letter-gameplay-picker__label">字體</span>
        <div className="letter-gameplay-picker__chips" role="listbox" aria-label="選擇字體風格">
          {NOTE_FONTS.map((font) => {
            const active = prefs?.note_font === font.id;
            return (
              <button
                key={font.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={disabled}
                className={`letter-gameplay-picker__chip letter-gameplay-picker__chip--font letter-gameplay-picker__chip--font-${font.id}${active ? ' letter-gameplay-picker__chip--active' : ''}`}
                onClick={() => pickFont(font.id)}
              >
                {font.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={`letter-gameplay-picker__sound${prefs?.sound_enabled ? '' : ' letter-gameplay-picker__sound--muted'}`}
          onClick={toggleSound}
          disabled={disabled}
          title={prefs?.sound_enabled ? '蓋印音效：開' : '蓋印音效：關'}
          aria-pressed={prefs?.sound_enabled !== false}
          aria-label={prefs?.sound_enabled !== false ? '蓋印音效：開' : '蓋印音效：關'}
        >
          {prefs?.sound_enabled !== false ? '音效' : '靜音'}
        </button>
      </div>

      {!compact && selectedStamp && (
        <p className="letter-gameplay-picker__preview">
          預覽蓋印：
          <span className="letter-gameplay-picker__preview-seal" aria-hidden="true">{selectedStamp.emoji}</span>
          {selectedStamp.label}
        </p>
      )}
    </div>
  );
}
