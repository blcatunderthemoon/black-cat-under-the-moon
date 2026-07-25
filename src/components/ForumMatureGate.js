import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  MATURE_FORUM_TOPIC,
  MATURE_POST_RULES_SUMMARY,
  MATURE_DECLINE_WARNING,
  persistMatureGateAck,
} from '../lib/forum-mature.js';
import { ForumIntimateIcon } from './ForumIcons.js';

function MatureGateRules() {
  return (
    <div className="forum-mature-modal__rules-box">
      <p className="forum-mature-modal__rules-title">社群規範</p>
      <ul className="forum-mature-modal__rules">
        {MATURE_POST_RULES_SUMMARY.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ForumMatureGate({
  open = true,
  session,
  loginRedirect = '/forum',
  onAcknowledged,
  onDismiss,
}) {
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [saving, setSaving] = useState(false);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    html.classList.add('body-scroll-locked');
    document.body.classList.add('body-scroll-locked');
    return () => {
      html.classList.remove('body-scroll-locked');
      document.body.classList.remove('body-scroll-locked');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') onDismiss?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onDismiss]);

  useEffect(() => {
    if (!open) {
      setChecked(false);
      setDeclined(false);
    }
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const handleBackdrop = () => {
    onDismiss?.();
  };

  let content;

  if (!session) {
    content = (
      <>
        <div className="forum-mature-modal__header">
          <span className="forum-mature-modal__icon" aria-hidden="true"><ForumIntimateIcon size={28} /></span>
          <span className="forum-mature-modal__badge">成熟話題 · 18+</span>
          <h2 id="forum-mature-gate-title" className="forum-mature-modal__title">
            {MATURE_FORUM_TOPIC}
          </h2>
          <p className="forum-mature-modal__lead">
            此版塊僅供已登入會員瀏覽。內容可能涉及親密關係與成人向話題，請先登入並確認年齡。
          </p>
        </div>
        <MatureGateRules />
        <div className="forum-mature-modal__footer">
          <div className="forum-mature-modal__actions">
            <Link
              href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
              className="forum-mature-modal__btn forum-mature-modal__btn--primary"
            >
              登入後繼續
            </Link>
            <button type="button" className="forum-mature-modal__btn forum-mature-modal__btn--outline" onClick={onDismiss}>
              返回樹洞首頁
            </button>
          </div>
        </div>
      </>
    );
  } else if (declined) {
    content = (
      <>
        <div className="forum-mature-modal__header forum-mature-modal__header--decline">
          <span className="forum-mature-modal__icon" aria-hidden="true">!</span>
          <h2 id="forum-mature-decline-title" className="forum-mature-modal__title">
            未能進入
          </h2>
          <p className="forum-mature-modal__warning">{MATURE_DECLINE_WARNING}</p>
        </div>
        <div className="forum-mature-modal__footer">
          <button type="button" className="forum-mature-modal__btn forum-mature-modal__btn--primary" onClick={onDismiss}>
            返回樹洞首頁
          </button>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className="forum-mature-modal__header">
          <span className="forum-mature-modal__icon" aria-hidden="true"><ForumIntimateIcon size={28} /></span>
          <span className="forum-mature-modal__badge">成熟話題 · 18+</span>
          <h2 id="forum-mature-gate-title" className="forum-mature-modal__title">
            進入前請先閱讀
          </h2>
          <p className="forum-mature-modal__lead">
            此版塊供會員以文字討論親密關係、界線、同意與多元性向。Black Cat 是社群討論空間，不是成人內容或性服務平台。
          </p>
        </div>
        <MatureGateRules />
        <div className="forum-mature-modal__confirm-card">
          <p className="forum-mature-modal__question">你是否已年滿 18 歲？</p>
          <label className="forum-mature-modal__confirm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>是，我確認已年滿 18 歲，並同意遵守此版社群規範。</span>
          </label>
        </div>
        <div className="forum-mature-modal__footer">
          <div className="forum-mature-modal__actions">
            <button
              type="button"
              className="forum-mature-modal__btn forum-mature-modal__btn--primary"
              disabled={!checked || saving}
              onClick={async () => {
                setSaving(true);
                await persistMatureGateAck({
                  userId,
                  accessToken: session?.access_token,
                });
                setSaving(false);
                onAcknowledged?.();
              }}
            >
              {saving ? '儲存中…' : `進入 ${MATURE_FORUM_TOPIC}`}
            </button>
            <button
              type="button"
              className="forum-mature-modal__btn forum-mature-modal__btn--decline"
              onClick={() => setDeclined(true)}
            >
              我未滿 18 歲
            </button>
            <button type="button" className="forum-mature-modal__btn forum-mature-modal__btn--outline" onClick={onDismiss}>
              返回樹洞首頁
            </button>
          </div>
          <p className="forum-mature-modal__persist-note">
            確認後會記在你的帳號，之後進入此版不會再詢問。
          </p>
        </div>
      </>
    );
  }

  return createPortal(
    <div
      className="forum-mature-overlay"
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        className="forum-mature-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={declined ? 'forum-mature-decline-title' : 'forum-mature-gate-title'}
      >
        <button
          type="button"
          className="forum-mature-modal__close"
          aria-label="關閉"
          onClick={onDismiss}
        >
          ×
        </button>
        {content}
      </div>
    </div>,
    document.body,
  );
}
