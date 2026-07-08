import { useRef, useState } from 'react';
import ForumComposeField from './ForumComposeField.js';
import { STORY_CONTENT_MAX, normalizeForumBodyContent } from '../lib/forum-story.js';
import { STORY_CHAPTER_TITLE_MAX } from '../lib/forum-story-chapters.js';
import { forumSubmitErrorMessage } from '../lib/forum-submit-error.js';

export default function ForumStoryAddChapter({
  postId,
  accessToken,
  nextChapterNumber,
  onAdded,
  onCancel,
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const contentRef = useRef('');
  const editorFlushRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      const res = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: title.trim() || null,
          content: normalized,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(forumSubmitErrorMessage(payload, '新增章節失敗。'));
        return;
      }
      onAdded?.(payload.chapters);
      setTitle('');
      setContent('');
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="forum-story-add-chapter" onSubmit={handleSubmit}>
      <div className="forum-story-add-chapter__head">
        <h3 id="forum-story-add-chapter-title" className="forum-story-add-chapter__title">新一章</h3>
        <div className="forum-story-add-chapter__head-actions">
          <span className="forum-story-add-chapter__badge">第 {nextChapterNumber} 章</span>
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
      <label className="forum-story-add-chapter__field">
        <span className="forum-story-add-chapter__label">章節標題（可選）</span>
        <input
          type="text"
          className="pixel-input forum-story-add-chapter__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={STORY_CHAPTER_TITLE_MAX}
          placeholder={`第 ${nextChapterNumber} 章`}
          disabled={submitting}
        />
      </label>
      <ForumComposeField
        label="章節內容"
        value={content}
        onChange={setContent}
        contentRef={contentRef}
        flushRef={editorFlushRef}
        accessToken={accessToken}
        maxLength={STORY_CONTENT_MAX}
        minRows={14}
        placeholder="寫下這一章的故事…"
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
          {submitting ? '發佈中…' : '發佈新章'}
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
