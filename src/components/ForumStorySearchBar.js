import { ForumSearchIcon } from './ForumIcons.js';

export default function ForumStorySearchBar({ value, onChange, onClear, disabled = false }) {
  return (
    <div className="forum-story-search" role="search">
      <label className="forum-story-search__label" htmlFor="forum-story-search-input">
        搜尋書名
      </label>
      <div className="forum-story-search__row">
        <span className="forum-story-search__icon" aria-hidden="true">
          <ForumSearchIcon size={14} />
        </span>
        <input
          id="forum-story-search-input"
          type="search"
          className="forum-story-search__input"
          placeholder="輸入書名關鍵字…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          enterKeyHint="search"
        />
        {value ? (
          <button
            type="button"
            className="forum-story-search__clear"
            onClick={onClear}
            disabled={disabled}
            aria-label="清除搜尋"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
