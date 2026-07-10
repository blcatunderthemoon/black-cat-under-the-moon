import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForumMarkdownBody from './ForumMarkdownBody.js';
import LoadingText from './LoadingText.js';

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
  const tiptapFlushRef = useRef(null);
  const stableFlushRef = useRef(null);
  const [previewContent, setPreviewContent] = useState(value);

  const flushEditorContent = useCallback(() => {
    const flushed = tiptapFlushRef.current?.() ?? latestContentRef.current ?? value;
    latestContentRef.current = flushed;
    if (contentRef) contentRef.current = flushed;
    return flushed;
  }, [contentRef, value]);

  useEffect(() => {
    latestContentRef.current = value;
    if (contentRef) contentRef.current = value;
    setPreviewContent(value);
  }, [value, contentRef]);

  useEffect(() => {
    const target = flushRef || stableFlushRef;
    target.current = flushEditorContent;
    return () => {
      target.current = null;
    };
  }, [flushRef, flushEditorContent]);

  function handleContentChange(next) {
    latestContentRef.current = next;
    if (contentRef) contentRef.current = next;
    setPreviewContent(next);
    onChange(next);
  }

  function openPreviewTab() {
    const flushed = flushEditorContent();
    if (flushed !== value) onChange(flushed);
    setPreviewContent(flushed);
    setTab('preview');
  }

  useEffect(() => {
    let cancelled = false;

    async function loadEditor() {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) return;
        try {
          const mod = await import('./ForumTiptapEditor.js');
          if (cancelled) return;
          setLoadError('');
          setTiptapEditor(() => mod.default);
          return;
        } catch (err) {
          if (attempt >= maxAttempts) {
            console.error('[ForumComposeField] TipTap editor failed to load', err);
            if (!cancelled) {
              setLoadError('編輯器載入失敗，請重新整理頁面。');
            }
            return;
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 400 * attempt);
          });
        }
      }
    }

    loadEditor();
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

  const previewMinHeight = Math.max(minRows * 24, 120);

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

      <div
        className={`forum-compose-field__editor-pane${tab !== 'edit' ? ' forum-compose-field__editor-pane--hidden' : ''}`}
        aria-hidden={tab !== 'edit'}
      >
        {!TiptapEditor ? (
          loadError ? (
            <div className="forum-compose-field__load-error">
              <p className="pixel-error forum-compose-field__preview-empty">{loadError}</p>
              <button
                type="button"
                className="pixel-btn forum-compose-field__reload-btn"
                onClick={() => window.location.reload()}
              >
                重新整理
              </button>
            </div>
          ) : (
            <LoadingText className="forum-compose-field__preview-empty" />
          )
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
            flushRef={tiptapFlushRef}
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
      </div>

      {tab === 'preview' && (
        <div
          className="forum-compose-field__preview pixel-textarea"
          style={{ minHeight: `${previewMinHeight}px` }}
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
