import { useState } from 'react';
import { STORY_SYNOPSIS_MAX } from '../lib/forum-story.js';

export default function ForumStorySynopsisEdit({
  postId,
  synopsis: initialSynopsis = '',
  accessToken,
  onSaved,
  onCancel,
}) {
  const [text, setText] = useState(initialSynopsis || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const value = text.trim();
      const res = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ synopsis: value || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || '更新簡介失敗。');
        return;
      }
      onSaved?.({ synopsis: payload.post?.synopsis ?? value });
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="forum-story-synopsis-modal" onSubmit={handleSubmit}>
      <div className="forum-story-synopsis-modal__head">
        <h3 id="forum-story-synopsis-title" className="forum-story-synopsis-modal__title">
          <span aria-hidden="true">📜</span> 編輯簡介
        </h3>
        {onCancel && (
          <button
            type="button"
            className="forum-story-add-chapter__close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="關閉"
          >
            ×
          </button>
        )}
      </div>
      <p className="forum-story-synopsis-modal__hint">
        簡介會顯示在書頁封面旁，讓讀者快速了解故事。不會出現在章節正文內。
      </p>
      <label className="forum-story-synopsis-modal__field">
        <span className="forum-story-add-chapter__label">故事簡介</span>
        <textarea
          className="forum-story-synopsis-edit__input forum-story-synopsis-modal__input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, STORY_SYNOPSIS_MAX))}
          maxLength={STORY_SYNOPSIS_MAX}
          placeholder="寫下故事簡介，讓讀者知道這本書講什麼…"
          rows={8}
          disabled={submitting}
          aria-label="故事簡介"
          autoFocus
        />
        <span className="forum-story-synopsis-modal__count">{text.length}/{STORY_SYNOPSIS_MAX}</span>
      </label>
      <div className="forum-story-add-chapter__actions">
        <button
          type="submit"
          className="forum-story-add-chapter__submit"
          disabled={submitting}
        >
          {submitting ? '儲存中…' : '儲存簡介'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="forum-story-add-chapter__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </button>
        )}
      </div>
      {error && <p className="pixel-error">{error}</p>}
    </form>
  );
}
