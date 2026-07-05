import { useEffect, useMemo, useState } from 'react';
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
}) {
  const [tab, setTab] = useState('edit');
  const [TiptapEditor, setTiptapEditor] = useState(null);
  const [loadError, setLoadError] = useState('');

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
            onClick={() => setTab('preview')}
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
              onChange={onChange}
              polls={polls}
              onPollsChange={onPollsChange}
              accessToken={accessToken}
              maxLength={maxLength}
              placeholder={placeholder}
              disabled={disabled}
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
          {value.trim() ? (
            <ForumMarkdownBody content={value} preview previewPolls={previewPolls} />
          ) : (
            <p className="forum-compose-field__preview-empty">尚無內容可預覽</p>
          )}
        </div>
      )}
    </div>
  );
}
