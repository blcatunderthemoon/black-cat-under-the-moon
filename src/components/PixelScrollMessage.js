import PixelMixedLabel from './PixelMixedLabel.js';
import PremiumMoonBadge from './PremiumMoonBadge.js';
import { getStampById, letterStyleFromMessage, notePaperClassName } from '../lib/letter-gameplay.js';

const SCROLL_ZH = 'scroll-text-zh';
const SCROLL_EN = 'scroll-text-en';

/** Horizontal parchment letter bubble for mystic inbox */
export default function PixelScrollMessage({
  content,
  isMine,
  senderName,
  senderIsPremium = false,
  timestamp,
  actions,
  children,
  letterStyle = null,
  message = null,
}) {
  const style = letterStyle || letterStyleFromMessage(message);
  const stampId = style?.stamp_id;
  const stamp = stampId ? getStampById(stampId) : null;
  const paperClass = style
    ? notePaperClassName(style.note_color, style.note_font)
    : 'note-paper--parchment note-font--zpix';

  return (
    <article
      className={`scroll-message ${isMine ? 'scroll-message--mine' : 'scroll-message--theirs'}`}
    >
      <div className={`scroll-message__paper ${paperClass}`}>
        {!isMine && (
          <span className="scroll-message__envelope-corner" aria-hidden="true" title="" />
        )}
        {stamp && !isMine && (
          <span
            className={`scroll-message__stamp scroll-message__stamp--settled scroll-message__stamp--${stampId}`}
            aria-hidden="true"
            title="蓋印"
          >
            {stamp.emoji}
          </span>
        )}
        <header className="scroll-message__head">
          <div className="scroll-message__head-meta">
            <span className="scroll-message__sender">
              <PixelMixedLabel text={senderName} zhClass={SCROLL_ZH} enClass={SCROLL_EN} />
              {senderIsPremium && <PremiumMoonBadge className="scroll-message__moon" />}
            </span>
            {timestamp && (
              <time className="scroll-message__time" dateTime={timestamp}>
                <PixelMixedLabel text={timestamp} zhClass={SCROLL_ZH} enClass={SCROLL_EN} />
              </time>
            )}
          </div>
          {isMine && stamp && (
            <span
              className={`scroll-message__wax-seal scroll-message__stamp scroll-message__stamp--header scroll-message__stamp--${stampId}`}
              aria-hidden="true"
              title="蓋印"
            >
              <span className="scroll-message__wax-seal__icon">{stamp.emoji}</span>
            </span>
          )}
          {isMine && !stamp && (
            <span className="scroll-message__wax-seal" aria-hidden="true" title="黑貓火漆">
              <span className="scroll-message__wax-seal__icon">🐈</span>
            </span>
          )}
        </header>
        {children || (
          <p className="scroll-message__text">
            <PixelMixedLabel text={content} zhClass={SCROLL_ZH} enClass={SCROLL_EN} />
          </p>
        )}
        {actions ? (
          <footer className="scroll-message__actions">{actions}</footer>
        ) : null}
      </div>
    </article>
  );
}

export function ScrollMixedText({ text, className = '' }) {
  if (text == null || text === '') return null;
  return (
    <span className={className}>
      <PixelMixedLabel text={String(text)} zhClass={SCROLL_ZH} enClass={SCROLL_EN} />
    </span>
  );
}
