/**
 * Auth pages brand — moon mark + blue→purple→cyan gradient wordmark.
 */
export default function AuthBrandHeader({ tagline, subtitle, className = '' }) {
  return (
    <header className={`auth-brand${className ? ` ${className}` : ''}`}>
      <span className="auth-brand__mark" aria-hidden="true" />
      <h1 className="auth-brand__title pixel-font">
        Black Cat
        <br />
        Under The Moon
      </h1>
      {tagline ? <p className="auth-welcome-tag">{tagline}</p> : null}
      {subtitle ? <p className="auth-welcome-subtag">{subtitle}</p> : null}
    </header>
  );
}
