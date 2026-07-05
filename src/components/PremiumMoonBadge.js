import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';

/** Moonlight Passport moon marker — interactive only in header via HeaderPremiumMoon. */
export default function PremiumMoonBadge({
  className = '',
  title = MOONLIGHT_PASSPORT_BRAND,
  interactive = false,
  onClick = null,
  tabIndex = undefined,
  ariaExpanded = undefined,
}) {
  const cls = `premium-moon-badge${interactive ? ' premium-moon-badge--interactive' : ''}${className ? ` ${className}` : ''}`;

  if (interactive) {
    return (
      <button
        type="button"
        className={cls}
        aria-label={title}
        aria-expanded={ariaExpanded === undefined ? undefined : ariaExpanded}
        title={title}
        onClick={onClick}
      >
        🌙
      </button>
    );
  }

  return (
    <span
      className={cls}
      aria-label={title}
      title={title}
      tabIndex={tabIndex}
    >
      🌙
    </span>
  );
}
