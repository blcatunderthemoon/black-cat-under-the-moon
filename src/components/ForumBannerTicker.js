import { useEffect, useState } from 'react';
import Link from 'next/link';

function BannerItem({ msg }) {
  const inner = (
    <>
      <span className="forum-banner-ticker__icon" aria-hidden="true">{msg.icon || '📢'}</span>
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

/**
 * Scrolling marquee banner under the forum filters panel.
 * Configured via Dashboard → 論壇橫幅.
 */
export default function ForumBannerTicker() {
  const [messages, setMessages] = useState(null);

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

  if (!messages?.length) return null;

  const duration = Math.max(18, messages.length * 14);

  return (
    <aside
      className="forum-banner-ticker forum-panel"
      role="complementary"
      aria-label="論壇公告"
    >
      <span className="forum-banner-ticker__sigil" aria-hidden="true">
        <span className="forum-banner-ticker__sigil-icon">🔥</span>
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
    </aside>
  );
}
