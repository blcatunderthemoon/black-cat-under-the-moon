import { getPasswordRequirementStatus } from '../lib/auth-credentials-policy.js';

export default function PasswordRequirementsChecklist({ password, className = '' }) {
  const value = String(password || '');
  if (!value) return null;

  const checks = getPasswordRequirementStatus(value);
  const rootClass = ['password-requirements', className].filter(Boolean).join(' ');

  return (
    <ul className={rootClass} aria-live="polite" aria-label="密碼要求">
      {checks.map((item) => (
        <li
          key={item.id}
          className={`password-requirements__item${item.met ? ' password-requirements__item--met' : ' password-requirements__item--unmet'}`}
          aria-label={`${item.label}：${item.met ? '已符合' : '尚未符合'}`}
        >
          <span className="password-requirements__icon" aria-hidden="true">
            {item.met ? '✓' : '○'}
          </span>
          <span className="password-requirements__label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
