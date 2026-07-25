/**
 * Wish share control — copy link / Threads / Instagram (+ native share when available).
 */

import { useEffect, useId, useRef, useState } from 'react';

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
  const [open, setOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    if (window.matchMedia('(max-width: 640px)').matches) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    setOpen(false);
  }

  async function shareNative() {
    const url = absoluteUrl();
    const payload = buildSharePayload(title, url);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
        onMessage?.('已打開分享');
        setOpen(false);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') {
          setOpen(false);
          return;
        }
      }
    }
    await copyLink();
  }

  function shareThreads() {
    const url = absoluteUrl();
    const payload = buildSharePayload(title, url);
    const intent = `https://www.threads.net/intent/post?text=${encodeURIComponent(`${payload.text}\n${payload.url}`)}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  async function shareInstagram() {
    const url = absoluteUrl();
    try {
      await navigator.clipboard.writeText(url);
      onMessage?.('連結已複製——可貼到 Instagram Story／帖文');
    } catch {
      onMessage?.('請手動複製網址，再貼到 Instagram');
    }
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  return (
    <div className={`wish-share${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="wish-detail__action-btn wish-detail__share-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <ShareIcon size={14} />
        分享心願
      </button>
      {open && (
        <>
          <button
            type="button"
            className="wish-share__backdrop"
            aria-label="關閉分享選單"
            onClick={() => setOpen(false)}
          />
          <div className="wish-share__menu" id={menuId} role="menu" aria-label="分享到">
            <p className="wish-share__menu-title">分享心願</p>
            {canNativeShare && (
              <button type="button" role="menuitem" className="wish-share__item" onClick={shareNative}>
                系統分享
              </button>
            )}
            <button type="button" role="menuitem" className="wish-share__item" onClick={copyLink}>
              複製連結
            </button>
            <button type="button" role="menuitem" className="wish-share__item" onClick={shareThreads}>
              分享到 Threads
            </button>
            <button type="button" role="menuitem" className="wish-share__item" onClick={shareInstagram}>
              分享到 Instagram
            </button>
            <button
              type="button"
              className="wish-share__cancel"
              onClick={() => setOpen(false)}
            >
              取消
            </button>
          </div>
        </>
      )}
    </div>
  );
}
