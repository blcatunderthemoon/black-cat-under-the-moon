/**
 * Shared moon-card shell for completed photo exchange (inbox thread + /exchange-photo view).
 */
export default function PhotoExchangeCompletedShell({ children, footer = null }) {
  return (
    <div className="photo-exchange-inbox-panel photo-exchange-inbox-panel--completed">
      <div className="pixel-card pixel-card--moon photo-exchange-inbox-panel__shell">
        {children}
      </div>
      {footer ? (
        <div className="photo-exchange-inbox-panel__footer">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
