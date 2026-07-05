/**
 * Auth pages brand — moon mark + blue→purple→cyan gradient wordmark.
 */
export default function AuthBrandHeader({ tagline, subtitle, className = '' }) {
  return (
    <header className={`auth-brand${className ? ` ${className}` : ''}`}>
      <img
        src="/blackcatunderthemoonmark.png"
        alt=""
        className="auth-brand__mark"
        width={72}
        height={72}
        aria-hidden="true"
        draggable={false}
      />
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
