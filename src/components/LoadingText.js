import { LOADING_LABEL, splitLoadingLabel } from '../lib/loading-label.js';

/**
 * Text-only loading label with animated trailing dots (no moon icon).
 */
export default function LoadingText({
  label = LOADING_LABEL,
  className = 'moon-loading__label',
  as: Tag = 'p',
  ...rest
}) {
  const { text, dots } = splitLoadingLabel(label);
  return (
    <Tag className={className} role="status" aria-live="polite" {...rest}>
      {text}
      {dots ? <span className="loading-dots" aria-hidden="true" /> : null}
    </Tag>
  );
}
