/**
 * Auth pages brand — site blue→purple→cyan gradient wordmark.
 */
import { useCallback, useRef } from 'react';

export default function AuthBrandHeader({ tagline, className = '' }) {
  const markBtnRef = useRef(null);
  const glowTimerRef = useRef(null);

  const pulseMarkGlow = useCallback(() => {
    const btn = markBtnRef.current;
    if (!btn) return;
    btn.classList.add('auth-brand__mark-btn--glow');
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    glowTimerRef.current = setTimeout(() => {
      btn.classList.remove('auth-brand__mark-btn--glow');
    }, 520);
  }, []);

  return (
    <header className={`auth-brand${className ? ` ${className}` : ''}`}>
      <button
        ref={markBtnRef}
        type="button"
        className="auth-brand__mark-btn"
        onClick={pulseMarkGlow}
        aria-label="Black Cat Under The Moon"
      >
        <img
          src="/blackcatunderthemoonmark.png"
          alt=""
          className="auth-brand__mark"
          width={317}
          height={379}
          aria-hidden="true"
          draggable="false"
        />
      </button>
      <h1 className="auth-brand__title pixel-font">
        Black Cat
        <br />
        Under The Moon
      </h1>
      {tagline ? <p className="auth-welcome-tag">{tagline}</p> : null}
    </header>
  );
}
