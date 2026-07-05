/**
 * Auth pages brand — site blue→purple→cyan gradient wordmark.
 */
export default function AuthBrandHeader({ tagline, className = '' }) {
  return (
    <header className={`auth-brand${className ? ` ${className}` : ''}`}>
      <img
        src="/blackcatunderthemoonmark.png"
        alt=""
        className="auth-brand__mark"
        width={317}
        height={379}
        aria-hidden="true"
      />
      <h1 className="auth-brand__title pixel-font">
        Black Cat
        <br />
        Under The Moon
      </h1>
      {tagline ? <p className="auth-welcome-tag">{tagline}</p> : null}
    </header>
  );
}
