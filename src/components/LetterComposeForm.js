import { useState, useCallback } from 'react';
import PixelMixedLabel from './PixelMixedLabel.js';
import ChannelStatusLine from './ChannelStatusLine.js';
import LetterGameplayPicker from './LetterGameplayPicker.js';
import { ForumPawIcon } from './UiIcons.js';
import { CHANNEL_MAX_ROUND_TRIPS } from '../lib/inbox-channel.js';
import {
  DEFAULT_LETTER_PREFS,
  getStampById,
  notePaperClassName,
  validateLetterStyle,
} from '../lib/letter-gameplay.js';
import { playStampSound } from '../lib/inbox-sounds.js';

const SCROLL_ZH = 'scroll-text-zh';
const SCROLL_EN = 'scroll-text-en';

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Inline parchment letter compose form for mystic inbox.
 */
export default function LetterComposeForm({
  mode = 'reply',
  title,
  hint,
  placeholder,
  value,
  onChange,
  onSubmit,
  sending = false,
  error = '',
  maxLength,
  showCancel = false,
  onCancel,
  cancelLabel = '取消',
  compact = false,
  channelRemaining = null,
  channelMax = null,
  statusVariant = 'channel',
  letterPrefs = null,
  onLetterPrefsChange,
  showGameplay = false,
  viewerTier = 'free',
}) {
  const modeClass = mode === 'open' ? 'letter-compose--open' : 'letter-compose--reply';
  const compactClass = compact ? ' letter-compose--compact' : '';
  const roundsMax = channelMax ?? CHANNEL_MAX_ROUND_TRIPS;
  const channelOpen = channelRemaining != null && channelRemaining > 0;
  const isWhisperStatus = statusVariant === 'whisper';
  const prefs = letterPrefs || { ...DEFAULT_LETTER_PREFS, unlocked_stamps: ['cat_paw'] };
  const stamp = getStampById(prefs.stamp_id);
  const paperClass = notePaperClassName(prefs.note_color, prefs.note_font);

  const [stamping, setStamping] = useState(false);
  const [stampFlash, setStampFlash] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (sending || stamping || !value.trim()) return;

    const letterStyle = validateLetterStyle(prefs, viewerTier);
    setStamping(true);
    setStampFlash(true);
    playStampSound(prefs.sound_enabled !== false);

    await wait(420);
    setStampFlash(false);

    try {
      await onSubmit?.(e, letterStyle);
    } finally {
      setStamping(false);
    }
  }, [sending, stamping, value, prefs, viewerTier, onSubmit]);

  const busy = sending || stamping;

  return (
    <article className={`letter-compose scroll-message scroll-message--${mode === 'reply' ? 'mine' : 'theirs'} ${modeClass}${compactClass}`}>
      <form className="letter-compose__form" onSubmit={handleSubmit}>
        {showGameplay && (
          <LetterGameplayPicker
            prefs={prefs}
            onChange={onLetterPrefsChange}
            compact={compact}
            disabled={busy}
          />
        )}
        <div className={`letter-compose__paper scroll-message__paper ${paperClass}${stampFlash ? ' scroll-message__paper--stamping' : ''}`}>
          {mode === 'open' && (
            <span className="scroll-message__envelope-corner" aria-hidden="true" title="" />
          )}
          {stampFlash && (
            <span
              className={`scroll-message__stamp scroll-message__stamp--imprint scroll-message__stamp--${prefs.stamp_id}`}
              aria-hidden="true"
            >
              {stamp.emoji}
            </span>
          )}
          <header className="letter-compose__head scroll-message__head">
            <span className="letter-compose__title scroll-message__sender">
              <PixelMixedLabel text={title} zhClass={SCROLL_ZH} enClass={SCROLL_EN} />
            </span>
            <div className="letter-compose__head-meta scroll-message__head-meta">
              {mode === 'reply' && (
                <span className="scroll-message__wax-seal scroll-message__wax-seal--inline" aria-hidden="true" title="黑貓火漆">
                  <span className="scroll-message__wax-seal__icon">
                    <ForumPawIcon size={12} />
                  </span>
                </span>
              )}
              <span className="letter-compose__count pixel-char-count">
                {value.length}
                /
                {maxLength}
              </span>
            </div>
          </header>
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={compact ? 3 : 5}
            className="letter-compose__textarea scroll-compose__textarea"
            disabled={busy}
          />
          <footer
            className={`letter-compose__footer scroll-compose__footer${showCancel ? ' letter-compose__footer--split' : ''}`}
          >
            {showCancel && (
              <button
                type="button"
                className="letter-compose__cancel"
                onClick={onCancel}
                disabled={busy}
              >
                {cancelLabel}
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className={`letter-compose__send scroll-send-paw scroll-send-paw--${prefs.stamp_id}${stamping ? ' letter-compose__send--stamping' : ''}`}
              title="蓋印發送"
              aria-label="蓋印發送"
            >
              {busy ? (
                <span className="letter-compose__send-label">…</span>
              ) : (
                <>
                  <span className="letter-compose__send-seal" aria-hidden="true">{stamp.emoji}</span>
                  <span className="letter-compose__send-label">蓋印</span>
                </>
              )}
            </button>
          </footer>
        </div>
        {hint && (
          <div className="letter-compose__hint-wrap">
            <ChannelStatusLine
              text={hint}
              channelOpen={channelOpen || isWhisperStatus}
              remaining={channelRemaining}
              max={isWhisperStatus ? (channelMax ?? roundsMax) : roundsMax}
              align="center"
              variant={statusVariant}
            />
          </div>
        )}
        {error && <p className="pixel-error letter-compose__error">{error}</p>}
      </form>
    </article>
  );
}
