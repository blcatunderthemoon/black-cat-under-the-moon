import Link from 'next/link';
import { optimizeForumDisplayUrl } from '../lib/cloudinary-forum-upload.js';
import { storyFeedPreviewText } from '../lib/forum-story.js';
import ForumAuthorName from './ForumAuthorName.js';
import {
  ForumBookIcon,
  ForumLikeStat,
  ForumCommentStat,
  HeaderBookmarkIcon,
} from './ForumIcons.js';

export default function ForumStoryBookshelf({
  posts,
  session,
  bookmarkingIds,
  onBookmark,
}) {
  return (
    <div className="forum-story-shelf" aria-label="故事書櫃">
      <div className="forum-story-shelf__ledge" aria-hidden="true" />
      <ul className="forum-story-shelf__grid">
        {posts.map((post) => {
          const href = post.members_gated && !session
            ? `/login?redirect=/forum/${encodeURIComponent(post.id)}`
            : `/forum/${post.id}`;
          const synopsis = storyFeedPreviewText(post, 100);

          return (
            <li key={post.id} className="forum-story-shelf__item">
              <article className={`forum-story-book${post.is_highlighted ? ' forum-story-book--crowned' : ''}`}>
                {session && (
                  <button
                    type="button"
                    className={`forum-story-book__bookmark${post.viewer_bookmarked ? ' forum-story-book__bookmark--active' : ''}`}
                    title={post.viewer_bookmarked ? '已收藏' : '收藏'}
                    aria-label={post.viewer_bookmarked ? '已收藏' : '收藏'}
                    aria-pressed={!!post.viewer_bookmarked}
                    disabled={bookmarkingIds?.has(post.id)}
                    onClick={(e) => onBookmark?.(post.id, e)}
                  >
                    <span aria-hidden="true"><HeaderBookmarkIcon size={14} /></span>
                  </button>
                )}
                <Link href={href} className={`forum-story-book__link${post.members_gated ? ' forum-story-book__link--gated' : ''}`}>
                  <div className="forum-story-book__cover-wrap">
                    {post.story_completed && (
                      <span className="forum-story-book__complete-ribbon" aria-label="已完結">完結</span>
                    )}
                    {post.cover_image_url ? (
                      <img
                        className="forum-story-book__cover"
                        src={optimizeForumDisplayUrl(post.cover_image_url)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div className="forum-story-book__cover forum-story-book__cover--placeholder">
                        <span aria-hidden="true"><ForumBookIcon size={28} /></span>
                      </div>
                    )}
                    <span className="forum-story-book__spine" aria-hidden="true" />
                  </div>
                  <h3 className="forum-story-book__title">{post.title || '無題'}</h3>
                  {synopsis && <p className="forum-story-book__synopsis">{synopsis}</p>}
                  <footer className="forum-story-book__meta">
                    <ForumAuthorName
                      name={post.anonymous_name_snapshot}
                      isMine={post.is_mine}
                      isPremium={post.author_is_premium}
                      mirrorSlug={post.author_mirror_slug}
                      onLinkClick={(e) => e.stopPropagation()}
                    />
                    <span className="forum-story-book__stats">
                      <ForumLikeStat count={post.like_count} />
                      <ForumCommentStat count={post.comment_count} />
                    </span>
                  </footer>
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
