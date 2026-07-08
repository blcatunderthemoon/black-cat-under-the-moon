import { useEffect, useMemo, useRef, useState } from 'react';
import ForumMarkdownBody from './ForumMarkdownBody.js';

export default function ForumComposeField({
  value,
  onChange,
  polls = [],
  onPollsChange,
  accessToken,
  maxLength = 2000,
  minRows = 5,
  placeholder = '說說你想說的…',
  required = false,
  disabled = false,
  className = '',
  label = '內容',
  storyMode = false,
  contentRef,
  flushRef,
}) {
  const [tab, setTab] = useState('edit');
  const [TiptapEditor, setTiptapEditor] = useState(null);
  const [loadError, setLoadError] = useState('');
  const latestContentRef = useRef(value);
  const internalFlushRef = useRef(null);
  const editorFlushRef = flushRef || internalFlushRef;
  const [previewContent, setPreviewContent] = useState(value);

  useEffect(() => {
    latestContentRef.current = value;
    if (contentRef) contentRef.current = value;
    setPreviewContent(value);
  }, [value, contentRef]);

  function handleContentChange(next) {
    latestContentRef.current = next;
    if (contentRef) contentRef.current = next;
    onChange(next);
  }

  function openPreviewTab() {
    const flushed = editorFlushRef.current?.() ?? latestContentRef.current ?? value;
    latestContentRef.current = flushed;
    if (contentRef) contentRef.current = flushed;
    if (flushed !== value) onChange(flushed);
    setPreviewContent(flushed);
    setTab('preview');
  }

  useEffect(() => {
    let cancelled = false;
    import('./ForumTiptapEditor.js')
      .then((mod) => {
        if (!cancelled) setTiptapEditor(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) setLoadError('編輯器載入失敗，請重新整理頁面。');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewPolls = useMemo(() => {
    const map = {};
    for (const poll of polls || []) {
      if (poll?.id) map[poll.id] = poll;
    }
    return map;
  }, [polls]);

  return (
    <div className={`forum-compose-field ${className}`.trim()}>
      <div className="forum-compose-field__label-row">
        <span className="forum-compose-field__label">{label}</span>
        <div className="forum-compose-field__mode" role="tablist" aria-label="檢視模式">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'edit'}
            className={`forum-compose-field__mode-btn${tab === 'edit' ? ' forum-compose-field__mode-btn--active' : ''}`}
            onClick={() => setTab('edit')}
          >
            撰寫
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={`forum-compose-field__mode-btn${tab === 'preview' ? ' forum-compose-field__mode-btn--active' : ''}`}
            onClick={openPreviewTab}
          >
            預覽
          </button>
        </div>
      </div>

      {tab === 'edit' ? (
        <>
          {loadError ? (
            <p className="pixel-error forum-compose-field__preview-empty">{loadError}</p>
          ) : !TiptapEditor ? (
            <p className="forum-compose-field__preview-empty">載入編輯器…</p>
          ) : (
            <TiptapEditor
              value={value}
              onChange={handleContentChange}
              contentRef={contentRef || latestContentRef}
              polls={polls}
              onPollsChange={onPollsChange}
              accessToken={accessToken}
              maxLength={maxLength}
              placeholder={placeholder}
              disabled={disabled}
              storyMode={storyMode}
              flushRef={editorFlushRef}
            />
          )}
          <input
            type="text"
            value={value}
            onChange={() => {}}
            required={required}
            tabIndex={-1}
            aria-hidden="true"
            className="forum-compose-field__validator"
          />
        </>
      ) : (
        <div
          className="forum-compose-field__preview pixel-textarea"
          style={{ minHeight: `${Math.max(minRows * 24, 120)}px` }}
        >
          {previewContent.trim() ? (
            <ForumMarkdownBody
              content={previewContent}
              preview
              previewPolls={previewPolls}
              storyMode={storyMode}
            />
          ) : (
            <p className="forum-compose-field__preview-empty">尚無內容可預覽</p>
          )}
        </div>
      )}
    </div>
  );
}
