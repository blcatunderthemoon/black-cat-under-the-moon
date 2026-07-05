import { splitPixelMixedText } from '../lib/pixel-mixed-text.js';

export default function PixelMixedLabel({
  text,
  zhClass = 'pixel-btn__zh',
  enClass = 'pixel-btn__en',
}) {
  const parts = splitPixelMixedText(text);
  if (!parts.length) return null;
  return (
    <span className="pixel-mixed-label">
      {parts.map(({ text: part, zh }, i) => (
        <span key={`${i}-${part}`} className={zh ? zhClass : enClass}>
          {part}
        </span>
      ))}
    </span>
  );
}
