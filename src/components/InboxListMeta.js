import PixelMixedLabel from './PixelMixedLabel.js';

/** Closed-channel hint shown in inbox list when reopen requires Mirror Card. */
export default function InboxClosedChannelHint() {
  return (
    <p className="inbox-letter-row__closed-hint">
      <span className="inbox-letter-row__closed-hint-icon" aria-hidden="true">🎴</span>
      <span className="inbox-letter-row__closed-hint-text">
        <span className="inbox-letter-row__closed-hint-dim">此處通道已關閉，可前往對方的</span>
        <span className="inbox-letter-row__closed-hint-glow">『靈魂鏡像』</span>
        <span className="inbox-letter-row__closed-hint-dim">留下新的回音。</span>
      </span>
    </p>
  );
}

export function InboxListMetaText({ text, badge = false }) {
  if (!text) return null;
  const isOpportunity = badge || /回信機會|尚餘.*次來回/.test(text);
  return (
    <span className={`inbox-letter-row__opportunity${isOpportunity ? ' inbox-letter-row__opportunity--badge' : ''}`}>
      {isOpportunity && (
        <span className="inbox-letter-row__opportunity-icon" aria-hidden="true">!</span>
      )}
      <PixelMixedLabel
        text={text}
        zhClass="inbox-letter-row__zh"
        enClass="inbox-letter-row__en"
      />
    </span>
  );
}
