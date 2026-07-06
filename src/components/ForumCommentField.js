import { useEffect, useId, useRef } from 'react';
import {
  clearForumDraft,
  forumCommentDraftKey,
  readForumDraft,
  writeForumDraft,
} from '../lib/forum-draft-storage.js';

/**
 * Plain textarea for post replies — avoids TipTap on mobile WebViews.
 */
export default function ForumCommentField({
  postId,
  value,
  onChange,
  maxLength = 500,
  minRows = 3,
  placeholder = '留下你的想法…',
  disabled = false,
  label = '回覆',
}) {
  const inputId = useId();
  const hydratedRef = useRef(false);
  const draftKey = postId ? forumCommentDraftKey(postId) : null;

  useEffect(() => {
    if (!draftKey || hydratedRef.current) return;
    hydratedRef.current = true;
    const draft = readForumDraft(draftKey);
    if (draft?.content) {
      onChange(String(draft.content).slice(0, maxLength));
    }
  }, [draftKey, maxLength, onChange]);

  useEffect(() => {
    if (!draftKey) return undefined;
    const timer = window.setTimeout(() => {
      const trimmed = String(value || '').trim();
      if (trimmed) writeForumDraft(draftKey, { content: trimmed });
      else clearForumDraft(draftKey);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftKey, value]);

  return (
    <div className="forum-comment-form__box">
      <label htmlFor={inputId} className="forum-compose-field__label">
        {label}
      </label>
      <textarea
        id={inputId}
        className="forum-comment-form__input"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        rows={minRows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        enterKeyHint="send"
      />
      <p className="forum-compose-field__count forum-comment-field__count" aria-live="polite">
        {String(value || '').length}/{maxLength}
      </p>
    </div>
  );
}
