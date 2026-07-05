import { useEffect, useId, useRef, useState } from 'react';
import {
  FORUM_TAG_LIMITS,
  canonicalForumTagKey,
  formatForumTagLabel,
  normalizeForumTagInput,
  validateForumTags,
} from '../lib/forum-tags.js';
import { getPresetTagsForTopic } from '../lib/forum-categories.js';

export default function ForumTagField({
  tags = [],
  onChange,
  disabled = false,
  topic = null,
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [displayByKey, setDisplayByKey] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const listId = useId();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const query = normalizeForumTagInput(input);
  const presetTags = (topic && topic !== '全部') ? getPresetTagsForTopic(topic) : [];
  const presetQuickPicks = presetTags.filter((item) => !tags.includes(item.tag));

  useEffect(() => {
    if (!query || disabled) {
      setSuggestions([]);
      setSuggestOpen(false);
      setHighlightIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingSuggest(true);
      try {
        const topicParam = topic && topic !== '全部'
          ? `&topic=${encodeURIComponent(topic)}`
          : '';
        const r = await fetch(
          `/api/forum/tags/suggest?q=${encodeURIComponent(query)}&limit=8${topicParam}`,
          { signal: controller.signal },
        );
        const data = await r.json().catch(() => ({}));
        const next = (data.suggestions || []).filter((item) => !tags.includes(item.tag));
        setSuggestions(next);
        setSuggestOpen(next.length > 0);
        setHighlightIndex(next.length ? 0 : -1);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
          setSuggestOpen(false);
        }
      } finally {
        setLoadingSuggest(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, tags, disabled, topic]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function addTag(rawDisplay, rawKey) {
    const display = normalizeForumTagInput(rawDisplay);
    const key = rawKey || canonicalForumTagKey(display);
    if (!key) return;

    const result = validateForumTags([...(tags || []), key]);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError('');
    onChange?.(result.tags);
    setDisplayByKey((prev) => ({
      ...prev,
      [key]: display || result.displayByKey[key] || key,
    }));
    setInput('');
    setSuggestions([]);
    setSuggestOpen(false);
    setHighlightIndex(-1);
  }

  function commitInput(raw) {
    const display = normalizeForumTagInput(raw);
    if (!display) return;

    const key = canonicalForumTagKey(display);
    const exact = suggestions.find((item) => item.tag === key);
    if (exact) {
      addTag(exact.display_label, exact.tag);
      return;
    }

    addTag(display, key);
  }

  function removeTag(tag) {
    onChange?.((tags || []).filter((t) => t !== tag));
    setDisplayByKey((prev) => {
      const next = { ...prev };
      delete next[tag];
      return next;
    });
    setError('');
  }

  function onKeyDown(e) {
    if (suggestOpen && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((index) => (index + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestOpen(false);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && highlightIndex >= 0) {
        e.preventDefault();
        const picked = suggestions[highlightIndex];
        if (picked) addTag(picked.display_label, picked.tag);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitInput(input);
    }
    if (e.key === 'Backspace' && !input && tags?.length) {
      removeTag(tags[tags.length - 1]);
    }
  }

  const atLimit = (tags?.length || 0) >= FORUM_TAG_LIMITS.maxTagsPerPost;
  const showLoadingPanel = loadingSuggest && query && !suggestions.length;
  const showSuggestList = suggestOpen && suggestions.length > 0;
  const showSuggestPanel = showLoadingPanel || showSuggestList;

  return (
    <div className="forum-tag-field" ref={wrapRef}>
      <div className="forum-tag-field__label-row">
        <span className="forum-tag-field__label">標籤</span>
        <span className="forum-tag-field__count">
          {tags?.length || 0}/{FORUM_TAG_LIMITS.maxTagsPerPost}
        </span>
      </div>
      <div className={`forum-tag-field__box${disabled ? ' forum-tag-field__box--disabled' : ''}`}>
        {(tags || []).map((tag) => (
          <span key={tag} className="forum-tag-chip">
            <span>{formatForumTagLabel(tag, displayByKey[tag])}</span>
            {!disabled && (
              <button
                type="button"
                className="forum-tag-chip__remove"
                onClick={() => removeTag(tag)}
                aria-label={`移除 ${formatForumTagLabel(tag, displayByKey[tag])}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {!disabled && !atLimit && (
          <div className="forum-tag-field__input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="forum-tag-field__input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={onKeyDown}
              onFocus={() => {
                if (suggestions.length) setSuggestOpen(true);
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  if (input.trim()) commitInput(input);
                }, 120);
              }}
              placeholder={tags?.length ? '再加標籤…' : '輸入 # 或開始打字，例如 LingOrm'}
              maxLength={FORUM_TAG_LIMITS.maxLength + 1}
              aria-label="新增標籤"
              aria-expanded={showSuggestPanel}
              aria-controls={showSuggestPanel ? listId : undefined}
              aria-busy={loadingSuggest}
              aria-autocomplete="list"
              role="combobox"
            />
            {showLoadingPanel && (
              <div className="forum-tag-suggest forum-tag-suggest--status" id={listId} role="status" aria-live="polite">
                <span className="forum-tag-suggest__spinner" aria-hidden="true" />
                <span>搜尋標籤中…</span>
              </div>
            )}
            {showSuggestList && (
              <ul className="forum-tag-suggest" id={listId} role="listbox">
                {suggestions.map((item, index) => (
                  <li key={item.tag} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={highlightIndex === index}
                      className={`forum-tag-suggest__item${highlightIndex === index ? ' forum-tag-suggest__item--active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addTag(item.display_label, item.tag)}
                    >
                      <span className="forum-tag-suggest__label">
                        🎴 {formatForumTagLabel(item.tag, item.display_label)}
                      </span>
                      <span className="forum-tag-suggest__count">
                        {item.count > 0 ? `已有 ${item.count} 篇` : '新標籤'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {presetQuickPicks.length > 0 && !disabled && (
        <div className="forum-tag-field__presets" role="group" aria-label="官方標籤建議">
          {presetQuickPicks.map((item) => (
            <button
              key={item.tag}
              type="button"
              className="forum-tag-chip forum-tag-chip--official forum-tag-chip--preset-pick"
              onClick={() => addTag(item.display_label, item.tag)}
            >
              {formatForumTagLabel(item.tag, item.display_label)}
            </button>
          ))}
        </div>
      )}
      <p className="forum-tag-field__hint">
        官方標籤一鍵加入 · 亦可自訂標籤 · 最多 {FORUM_TAG_LIMITS.maxTagsPerPost} 個
      </p>
      {error && <p className="pixel-error forum-tag-field__error">{error}</p>}
    </div>
  );
}
