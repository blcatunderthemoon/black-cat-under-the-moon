import { useEffect, useId, useState } from 'react';
import ForumComposeOverlay from './ForumComposeOverlay.js';
import { TOPIC_STYLES } from '../lib/forum-categories.js';
import { getWelcomePost } from '../lib/forum-welcome.js';
import {
  WELCOME_CONTENT_MAX,
  WELCOME_MOOD_TAGS,
  WELCOME_TITLE_MAX,
} from '../lib/forum-welcome-store.js';
import { forumModFetch } from '../lib/forum-mod-api.js';
import { ForumTopicIcon, ForumPinIcon } from './ForumIcons.js';

function welcomeBadgeLabel(moodTag) {
  if (moodTag === '版規') return '版規';
  if (moodTag === '指南') return '指南';
  return '官方';
}

export function canEditWelcomeTopic(profile, topic) {
  const p = profile?.profile;
  if (!p?.is_forum_staff || topic === '全部') return false;
  if (p.can_admin_forum) return true;
  const topics = p.forum_moderator_topics;
  if (!topics?.length) return true;
  if (topics.includes('全部')) return true;
  return topics.includes(topic);
}

function WelcomeEditModal({
  topic,
  welcome,
  accessToken,
  onSaved,
  onCancel,
}) {
  const [title, setTitle] = useState(welcome.title || '');
  const [content, setContent] = useState(welcome.content || '');
  const [moodTag, setMoodTag] = useState(welcome.mood_tag || '官方');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!accessToken || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { ok, data } = await forumModFetch('/api/forum/welcome', {
        method: 'PATCH',
        accessToken,
        body: { topic, title, content, mood_tag: moodTag },
      });
      if (!ok) {
        setError(data.error || '儲存失敗');
        return;
      }
      onSaved?.(data.welcome);
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (!accessToken || submitting) return;
    if (!window.confirm('確定還原為預設版規？自訂內容將被清除。')) return;
    setSubmitting(true);
    setError('');
    try {
      const { ok, data } = await forumModFetch('/api/forum/welcome', {
        method: 'PATCH',
        accessToken,
        body: { topic, reset: true },
      });
      if (!ok) {
        setError(data.error || '還原失敗');
        return;
      }
      onSaved?.(data.welcome);
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ForumComposeOverlay
      modalClassName="forum-compose-modal--welcome-edit"
      ariaLabelledBy="forum-welcome-edit-title"
    >
      <form className="forum-welcome-edit" onSubmit={handleSubmit}>
        <div className="forum-welcome-edit__head">
          <h3 id="forum-welcome-edit-title" className="forum-welcome-edit__title">編輯版規</h3>
          <button
            type="button"
            className="forum-welcome-edit__close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="關閉"
          >
            ×
          </button>
        </div>
        <p className="forum-welcome-edit__hint">
          此內容會顯示在版塊頂部的歡迎／版規卡片，所有會員都可見。
        </p>
        <label className="forum-welcome-edit__field">
          <span className="forum-welcome-edit__label">標題</span>
          <input
            type="text"
            className="pixel-input forum-welcome-edit__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={WELCOME_TITLE_MAX}
            disabled={submitting}
            required
          />
        </label>
        <label className="forum-welcome-edit__field">
          <span className="forum-welcome-edit__label">標籤</span>
          <select
            className="pixel-input forum-welcome-edit__select"
            value={moodTag}
            onChange={(e) => setMoodTag(e.target.value)}
            disabled={submitting}
          >
            {WELCOME_MOOD_TAGS.map((tag) => (
              <option key={tag} value={tag}>{welcomeBadgeLabel(tag)}</option>
            ))}
          </select>
        </label>
        <label className="forum-welcome-edit__field">
          <span className="forum-welcome-edit__label">
            內容
            <span className="forum-welcome-edit__count">{content.length}/{WELCOME_CONTENT_MAX}</span>
          </span>
          <textarea
            className="pixel-input forum-welcome-edit__textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={WELCOME_CONTENT_MAX}
            rows={12}
            disabled={submitting}
            required
          />
        </label>
        <div className="forum-welcome-edit__actions">
          <button
            type="submit"
            className="forum-welcome-edit__submit"
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? '儲存中…' : '儲存版規'}
          </button>
          {welcome.is_custom && (
            <button
              type="button"
              className="forum-welcome-edit__reset"
              onClick={handleReset}
              disabled={submitting}
            >
              還原預設
            </button>
          )}
          <button
            type="button"
            className="forum-welcome-edit__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </button>
        </div>
        {error && <p className="pixel-error forum-welcome-edit__error">{error}</p>}
      </form>
    </ForumComposeOverlay>
  );
}

export default function ForumWelcomeCard({
  topic,
  canEdit = false,
  accessToken,
}) {
  const ts = TOPIC_STYLES[topic] || TOPIC_STYLES['全部'];
  const bodyId = useId();
  const storageKey = `bcutm_forum_welcome_open:${topic}`;
  const [welcome, setWelcome] = useState(() => getWelcomePost(topic));
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWelcome(getWelcomePost(topic));
    fetch(`/api/forum/welcome?topic=${encodeURIComponent(topic)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.welcome) setWelcome(data.welcome);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [topic]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  function handleEditClick(e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    setEditing(true);
  }

  return (
    <>
      <article
        className={`forum-welcome-card${open ? ' forum-welcome-card--open' : ' forum-welcome-card--collapsed'}`}
        style={{ borderColor: `${ts.accent}55` }}
      >
        <div className="forum-welcome-card__header">
          <button
            type="button"
            className="forum-welcome-card__toggle"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={bodyId}
          >
            <h3 className="forum-welcome-card__title">
              <span className="forum-welcome-card__title-text">
                <ForumTopicIcon topic={topic} size={14} className="forum-welcome-card__topic-icon" />
                {' '}{welcome.title}
              </span>
              <span className="forum-welcome-card__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
            </h3>
          </button>
          <div className="forum-welcome-card__meta">
            {canEdit && (
              <button
                type="button"
                className="forum-welcome-card__edit"
                onClick={handleEditClick}
                title="編輯版規"
              >
                編輯
              </button>
            )}
            <span className="forum-welcome-card__badge">
              <ForumPinIcon size={11} /> {welcomeBadgeLabel(welcome.mood_tag)}
            </span>
          </div>
        </div>
        <div
          id={bodyId}
          className="forum-welcome-card__body"
          hidden={!open}
        >
          <p className="forum-welcome-card__content">{welcome.content}</p>
        </div>
      </article>

      {editing && (
        <WelcomeEditModal
          topic={topic}
          welcome={welcome}
          accessToken={accessToken}
          onSaved={(next) => {
            setWelcome(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </>
  );
}
