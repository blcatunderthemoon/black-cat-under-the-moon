/**
 * Pixel-art campfire for forum empty state / atmosphere.
 * @param {{ variant?: 'inline' | 'hero' }} props
 */

export default function ForumCampfireGlow({ variant = 'inline' }) {
  return (
    <div className={`forum-campfire${variant === 'hero' ? ' forum-campfire--hero' : ''}`} aria-hidden="true">
      <div className="forum-campfire__scene">
        <div className="forum-campfire__glow" />
        <div className="forum-campfire__stack">
          <div className="forum-campfire__flames">
            <span className="forum-campfire__flame forum-campfire__flame--back" />
            <span className="forum-campfire__flame forum-campfire__flame--mid" />
            <span className="forum-campfire__flame forum-campfire__flame--front" />
          </div>
          <div className="forum-campfire__logs">
            <span className="forum-campfire__log forum-campfire__log--l" />
            <span className="forum-campfire__log forum-campfire__log--c" />
            <span className="forum-campfire__log forum-campfire__log--r" />
          </div>
        </div>
        <span className="forum-campfire__ember forum-campfire__ember--1" />
        <span className="forum-campfire__ember forum-campfire__ember--2" />
        <span className="forum-campfire__ember forum-campfire__ember--3" />
      </div>
    </div>
  );
}
