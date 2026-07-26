/**
 * Wish share — Web Share API (OS sheet: Messages / Threads / IG / copy…) when available;
 * otherwise copy link.
 */

function ShareIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49" />
      <path d="m15.41 6.51-6.82 3.98" />
    </svg>
  );
}

function buildSharePayload(title, url) {
  const safeTitle = String(title || '月光心願').trim();
  const text = `「${safeTitle}」——嚟月光心願為我打氣`;
  return { title: safeTitle, text, url };
}

export default function WishShareButton({ title, path, onMessage }) {
  function absoluteUrl() {
    if (typeof window === 'undefined') return path || '';
    try {
      return new URL(path || window.location.pathname, window.location.origin).toString();
    } catch {
      return window.location.href;
    }
  }

  async function copyLink() {
    const url = absoluteUrl();
    try {
      await navigator.clipboard.writeText(url);
      onMessage?.('連結已複製');
    } catch {
      onMessage?.('複製失敗，請手動複製網址');
    }
  }

  async function share() {
    const url = absoluteUrl();
    const payload = buildSharePayload(title, url);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  return (
    <button
      type="button"
      className="wish-detail__action-btn wish-detail__share-btn"
      onClick={share}
    >
      <ShareIcon size={14} />
      分享心願
    </button>
  );
}
