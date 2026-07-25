import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ForumFlameIcon, ForumMegaphoneIcon, ForumSparkleIcon } from './ForumIcons.js';

const DISMISS_KEY = 'bcutm_forum_banner_dismissed';

function BannerItem({ msg }) {
  const Icon = msg.type === 'post' ? ForumSparkleIcon : ForumMegaphoneIcon;
  const inner = (
    <>
      <span className="forum-banner-ticker__icon" aria-hidden="true">
        <Icon size={13} />
      </span>
      {msg.type === 'post' && (
        <span className="forum-banner-ticker__label">精選貼文</span>
      )}
      <span className="forum-banner-ticker__text">{msg.text}</span>
      {msg.href && (
        <span className="forum-banner-ticker__arrow" aria-hidden="true">›</span>
      )}
    </>
  );

  if (msg.href) {
    return (
      <Link href={msg.href} className="forum-banner-ticker__item forum-banner-ticker__item--link">
        {inner}
      </Link>
    );
  }

  return (
    <span className="forum-banner-ticker__item">
      {inner}
    </span>
  );
}

/** Render messages with a twinkling separator between each item. */
function BannerSequence({ messages, keyPrefix }) {
  return messages.map((msg) => (
    <span className="forum-banner-ticker__cell" key={`${keyPrefix}-${msg.id}`}>
      <BannerItem msg={msg} />
      <span className="forum-banner-ticker__sep" aria-hidden="true">✦</span>
    </span>
  ));
}

function messagesFingerprint(messages) {
  return (messages || []).map((m) => String(m.id || m.text || '')).join('|');
}

/**
 * Scrolling marquee banner under the forum header / above filters.
 * Configured via Dashboard → 論壇橫幅. Users can dismiss until content changes.
 */
export default function ForumBannerTicker() {
  const [messages, setMessages] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/forum/banner', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.active && Array.isArray(data.messages) && data.messages.length) {
          setMessages(data.messages);
        } else if (!cancelled) {
          setMessages([]);
        }
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => { cancelled = true; };
  }, []);

  const fingerprint = useMemo(() => messagesFingerprint(messages), [messages]);

  useEffect(() => {
    if (!fingerprint) return;
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      setDismissed(stored === fingerprint);
    } catch {
      setDismissed(false);
    }
  }, [fingerprint]);

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, fingerprint);
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (!messages?.length || dismissed) return null;

  const duration = Math.max(18, messages.length * 14);

  return (
    <aside
      className="forum-banner-ticker forum-panel"
      role="complementary"
      aria-label="論壇公告"
    >
      <span className="forum-banner-ticker__sigil" aria-hidden="true">
        <span className="forum-banner-ticker__sigil-icon">
          <ForumFlameIcon size={14} />
        </span>
        <span className="forum-banner-ticker__pulse" />
      </span>
      <div className="forum-banner-ticker__viewport">
        <div
          className="forum-banner-ticker__track"
          style={{ '--forum-banner-duration': `${duration}s` }}
        >
          <div className="forum-banner-ticker__content">
            <BannerSequence messages={messages} keyPrefix="a" />
            <BannerSequence messages={messages} keyPrefix="b" />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="forum-banner-ticker__dismiss"
        aria-label="關閉公告"
        title="關閉"
        onClick={handleDismiss}
      >
        ×
      </button>
    </aside>
  );
}
