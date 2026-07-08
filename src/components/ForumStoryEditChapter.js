import { useEffect, useRef, useState } from 'react';
import ForumComposeField from './ForumComposeField.js';
import { STORY_CONTENT_MAX, normalizeForumBodyContent } from '../lib/forum-story.js';
import { STORY_CHAPTER_TITLE_MAX } from '../lib/forum-story-chapters.js';
import { forumSubmitErrorMessage } from '../lib/forum-submit-error.js';

export default function ForumStoryEditChapter({
  postId,
  chapter,
  accessToken,
  onSaved,
  onCancel,
}) {
  const [title, setTitle] = useState(chapter?.title || '');
  const [content, setContent] = useState(chapter?.content || '');
  const contentRef = useRef(chapter?.content || '');
  const editorFlushRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const body = chapter?.content || '';
    if (body.trim()) {
      setContent(body);
      contentRef.current = body;
      return undefined;
    }
    if (!postId || !accessToken || !chapter) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}/chapters`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const match = (payload.chapters || []).find(
          (ch) => String(ch.id) === String(chapter.id)
            || ch.chapter_number === chapter.chapter_number,
        );
        if (match?.content?.trim()) {
          setContent(match.content);
          contentRef.current = match.content;
        }
      } catch {
        /* keep empty; user can retry */
      }
    })();

    return () => { cancelled = true; };
  }, [chapter, postId, accessToken]);

  async function handleSubmit(e) {
    e.preventDefault();
    const latest = editorFlushRef.current?.() ?? contentRef.current ?? content;
    const normalized = normalizeForumBodyContent(latest);
    if (!normalized.trim()) {
      setError('請填寫章節內容。');
      return;
    }
    contentRef.current = normalized;
    setContent(normalized);
    setSubmitting(true);
    setError('');
    try {
      const chapterKey = chapter?.id || `legacy-${chapter?.chapter_number || 1}`;
      const res = await fetch(
        `/api/forum/posts/${encodeURIComponent(postId)}/chapters/${encodeURIComponent(chapterKey)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: title.trim() || null,
            content: normalized,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(forumSubmitErrorMessage(payload, '更新章節失敗。'));
        return;
      }
      onSaved?.(payload.chapters);
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="forum-story-add-chapter forum-story-edit-chapter" onSubmit={handleSubmit}>
      <div className="forum-story-add-chapter__head">
        <h3 id="forum-story-edit-chapter-title" className="forum-story-add-chapter__title">編輯章節內容</h3>
        <div className="forum-story-add-chapter__head-actions">
          <span className="forum-story-add-chapter__badge">
            {chapter?.display_title || `第 ${chapter?.chapter_number || 1} 章`}
          </span>
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
      </div>
      <p className="forum-story-synopsis-modal__hint">
        修改本章正文。簡介請在書頁的「編輯簡介」中更新。
      </p>
      <label className="forum-story-add-chapter__field">
        <span className="forum-story-add-chapter__label">章節標題（可選）</span>
        <input
          type="text"
          className="pixel-input forum-story-add-chapter__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={STORY_CHAPTER_TITLE_MAX}
          placeholder={chapter?.display_title || '章節標題'}
          disabled={submitting}
        />
      </label>
      <ForumComposeField
        key={chapter?.id || `ch-${chapter?.chapter_number}`}
        label="章節內容"
        value={content}
        onChange={setContent}
        contentRef={contentRef}
        flushRef={editorFlushRef}
        accessToken={accessToken}
        maxLength={STORY_CONTENT_MAX}
        minRows={14}
        placeholder="編輯這一章的內容…"
        disabled={submitting}
        className="forum-story-add-chapter__editor"
        storyMode
      />
      <div className="forum-story-add-chapter__actions">
        <button
          type="submit"
          className="forum-story-add-chapter__submit"
          disabled={submitting || !content.trim()}
        >
          {submitting ? '儲存中…' : '儲存修改'}
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
      {error && <p className="pixel-error forum-story-add-chapter__error">{error}</p>}
    </form>
  );
}
