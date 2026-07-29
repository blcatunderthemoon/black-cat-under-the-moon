/**
 * Random Cantonese icebreaker draw + confirm-before-send for 月光低語.
 */

import { useState } from 'react';
import { pickRandomWhisperOpener } from '../lib/inbox-match-whisper.js';
import { ForumSparkleIcon } from './UiIcons.js';

export default function MatchWhisperOpeners({
  visible = false,
  disabled = false,
  onPick,
}) {
  const [drawn, setDrawn] = useState(null);
  const [spinning, setSpinning] = useState(false);

  if (!visible) return null;

  function drawNext() {
    if (disabled || spinning) return;
    setSpinning(true);
    window.setTimeout(() => {
      setDrawn(pickRandomWhisperOpener(drawn?.id || null));
      setSpinning(false);
    }, 220);
  }

  return (
    <div className="match-whisper-openers" role="group" aria-label="隨機開場白">
      <p className="match-whisper-openers__lead">
        唔知點開波？可以隨機抽一句輕鬆／搞笑廣東話開場白——確認後先寄，唔會自動 send。
      </p>

      <button
        type="button"
        className={`match-whisper-openers__draw${spinning ? ' match-whisper-openers__draw--spin' : ''}`}
        disabled={disabled || spinning}
        onClick={drawNext}
      >
        <span className="match-whisper-openers__draw-icon" aria-hidden="true">
          <ForumSparkleIcon size={16} />
        </span>
        <span>{drawn ? '再抽一次' : '隨機抽一句'}</span>
      </button>

      {drawn && (
        <div className="match-whisper-openers__result" aria-live="polite">
          <p className="match-whisper-openers__result-tag">{drawn.label}</p>
          <p className="match-whisper-openers__result-text">{drawn.text}</p>
          <button
            type="button"
            className="match-whisper-openers__use pixel-btn pixel-btn--primary"
            disabled={disabled}
            onClick={() => onPick?.(drawn)}
          >
            用呢句（會再確認）
          </button>
        </div>
      )}
    </div>
  );
}

export function MatchWhisperSendConfirm({
  open,
  text,
  partnerName,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="mirror-report-overlay show match-whisper-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-whisper-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="mirror-report-overlay__box match-whisper-confirm__box">
        <p className="match-whisper-confirm__eyebrow">月光低語</p>
        <h2 className="mirror-report-overlay__title" id="match-whisper-confirm-title">
          確認寄出開場白？
        </h2>
        <p className="mirror-report-overlay__sub match-whisper-confirm__sub">
          {partnerName
            ? `將寄俾 ${partnerName}。確認前唔會送出。`
            : '確認前唔會送出。'}
        </p>
        <blockquote className="match-whisper-confirm__preview">
          {text}
        </blockquote>
        <button
          type="button"
          className="mirror-report-overlay__confirm"
          disabled={busy || !String(text || '').trim()}
          onClick={onConfirm}
        >
          {busy ? '寄出中…' : '確認寄出'}
        </button>
        <button
          type="button"
          className="mirror-report-overlay__cancel"
          disabled={busy}
          onClick={onCancel}
        >
          再諗諗
        </button>
      </div>
    </div>
  );
}
