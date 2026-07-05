import { formatForumTagLabel } from '../lib/forum-tags.js';

export default function ForumPostTags({
  tags = [],
  tagLabels = {},
  className = '',
  onTagClick,
  activeTag = null,
  variant = 'default',
  officialTagKeys = null,
}) {
  if (!tags?.length) return null;

  const officialSet = officialTagKeys instanceof Set
    ? officialTagKeys
    : (officialTagKeys ? new Set(officialTagKeys) : null);

  return (
    <div className={`forum-post-tags forum-post-tags--${variant} ${className}`.trim()}>
      {tags.map((tag) => {
        const isActive = activeTag === tag;
        const isOfficial = officialSet?.has(tag);
        const label = formatForumTagLabel(tag, null, tagLabels);
        const chipClass = `forum-tag-chip forum-tag-chip--compact${isOfficial ? ' forum-tag-chip--official' : ''}${isActive ? ' forum-tag-chip--active' : ''}`;
        if (onTagClick) {
          return (
            <button
              key={tag}
              type="button"
              className={chipClass}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTagClick(tag);
              }}
            >
              {label}
            </button>
          );
        }
        return (
          <span key={tag} className={`${chipClass} forum-tag-chip--static`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
