import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { displayTopic, TOPIC_STYLES } from '../lib/forum-categories.js';
import { formatActorScopeLabel } from '../lib/forum-moderator-assignments.js';
import { forumModFetch } from '../lib/forum-mod-api.js';
import { dashboardFetch } from '../lib/dashboard-fetch.js';
import ForumModConfirmOverlay from './ForumModConfirmOverlay.js';
import MoonLoading from './MoonLoading.js';

const AUTO_REFRESH_MS = 45000;

const ACTION_HINTS = {
  hide: '軟刪：前台隱藏，資料保留，可恢復',
  unhide: '還原為可見',
  pin: '在此版塊內置頂',
  highlight: '標記精華，出現在月光精選',
  hardDelete: '永久刪除，僅管理員',
  hideComment: '隱藏留言（夜幕降臨）',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return '剛才';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 日前`;
}

function ActionButton({ label, onClick, disabled, variant = 'default', title }) {
  const variantClass = variant === 'danger'
    ? 'forum-mod-queue__btn--danger'
    : variant === 'success'
      ? 'forum-mod-queue__btn--success'
      : variant === 'ghost'
        ? 'forum-mod-queue__btn--ghost'
        : '';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`forum-mod-queue__btn ${variantClass}`.trim()}
    >
      {label}
    </button>
  );
}

function TopicBadge({ topic }) {
  if (!topic) return null;
  const label = displayTopic(topic);
  const accent = TOPIC_STYLES[label]?.accent || '#bd93f9';
  return (
    <span
      className="forum-mod-queue__topic"
      style={{ borderColor: `${accent}66`, color: accent }}
    >
      {TOPIC_STYLES[label]?.emoji ? `${TOPIC_STYLES[label].emoji} ` : ''}{label}
    </span>
  );
}

function StatChip({ label, value, tone = 'default' }) {
  return (
    <div className={`forum-mod-queue__stat forum-mod-queue__stat--${tone}`}>
      <span className="forum-mod-queue__stat-value">{value}</span>
      <span className="forum-mod-queue__stat-label">{label}</span>
    </div>
  );
}

/**
 * Shared moderation queue — works with Bearer (front-end 版主) or dashboard key.
 */
export default function ForumModQueuePanel({
  authMode = 'bearer',
  accessToken = null,
  actorMeta = null,
  onError,
  onQueueLoaded,
  showScope = true,
  showLegend = false,
}) {
  const [queue, setQueue] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [localError, setLocalError] = useState('');
  const [filter, setFilter] = useState('all');
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmNote, setConfirmNote] = useState('');

  const canAdmin = actorMeta?.can_admin ?? authMode === 'dashboard';

  const apiFetch = useCallback(async (path, options = {}) => {
    if (authMode === 'dashboard') {
      return dashboardFetch(path, options).then(async (res) => ({
        ok: res.ok,
        status: res.status,
        data: await res.json().catch(() => ({})),
      }));
    }
    return forumModFetch(path, { ...options, accessToken });
  }, [authMode, accessToken]);

  const loadQueue = useCallback(async () => {
    setLocalError('');
    try {
      const { ok, data } = await apiFetch('/api/forum/moderation/queue');
      if (!ok) {
        const message = data.error || '載入失敗';
        setLocalError(message);
        onError?.(message);
        setQueue({ posts: [], comments: [], actor: null, recent_reports: [] });
        return;
      }
      setQueue(data);
      setLastRefreshAt(Date.now());
      onQueueLoaded?.(data);
    } catch {
      const message = '無法連線至檢舉佇列';
      setLocalError(message);
      onError?.(message);
    }
  }, [apiFetch, onError, onQueueLoaded]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (authMode === 'dashboard') return undefined;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadQueue();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [authMode, loadQueue]);

  async function modAction(method, path, body) {
    setBusyId(path);
    setLocalError('');
    try {
      const { ok, data } = await apiFetch(path, {
        method,
        body,
      });
      if (!ok) {
        const message = data.error || '操作失敗';
        setLocalError(message);
        onError?.(message);
        return false;
      }
      await loadQueue();
      return true;
    } catch {
      const message = '操作失敗';
      setLocalError(message);
      onError?.(message);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const posts = queue?.posts || [];
  const comments = queue?.comments || [];
  const recentReports = queue?.recent_reports || [];
  const actor = queue?.actor || actorMeta;
  const scopeLabel = formatActorScopeLabel(actor);
  const totalPending = posts.length + comments.length;

  const visibleSections = useMemo(() => ({
    posts: filter === 'all' || filter === 'posts',
    comments: filter === 'all' || filter === 'comments',
  }), [filter]);

  function closeConfirm() {
    setConfirm(null);
    setConfirmNote('');
  }

  async function runConfirm() {
    if (!confirm || busyId) return;
    const body = confirm.showNote && confirmNote.trim()
      ? { ...(confirm.body || {}), note: confirmNote.trim() }
      : confirm.body;
    const ok = await modAction(confirm.method, confirm.path, body);
    if (ok) closeConfirm();
  }

  return (
    <div className="forum-mod-queue">
      <ForumModConfirmOverlay
        open={!!confirm}
        title={confirm?.title}
        sub={confirm?.sub}
        icon={confirm?.icon}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        showNote={confirm?.showNote}
        note={confirmNote}
        onNoteChange={setConfirmNote}
        busy={!!busyId}
        onConfirm={runConfirm}
        onCancel={closeConfirm}
      />
      {queue && (
        <div className="forum-mod-queue__stats" aria-label="佇列摘要">
          <StatChip label="待處理" value={totalPending} tone={totalPending > 0 ? 'warn' : 'calm'} />
          <StatChip label="被檢舉貼文" value={posts.length} />
          <StatChip label="被檢舉留言" value={comments.length} />
          {recentReports.length > 0 && (
            <StatChip label="近期檢舉" value={recentReports.length} tone="muted" />
          )}
        </div>
      )}

      {showScope && actor && authMode === 'bearer' && (
        <p className="forum-mod-queue__scope">
          你負責的版塊：<strong>{scopeLabel}</strong>
        </p>
      )}

      {showLegend && (
        <details className="forum-mod-queue__legend">
          <summary>操作說明</summary>
          <ul>
            <li><strong>夜幕降臨</strong> — {ACTION_HINTS.hide}</li>
            <li><strong>圍爐置頂</strong> — {ACTION_HINTS.pin}</li>
            <li><strong>月光加冕</strong> — {ACTION_HINTS.highlight}</li>
            {canAdmin && <li><strong>硬刪</strong> — {ACTION_HINTS.hardDelete}</li>}
          </ul>
        </details>
      )}

      <div className="forum-mod-queue__toolbar">
        <div className="forum-mod-queue__filters" role="tablist" aria-label="佇列篩選">
          {[
            { id: 'all', label: '全部' },
            { id: 'posts', label: '貼文' },
            { id: 'comments', label: '留言' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`forum-mod-queue__filter${filter === tab.id ? ' forum-mod-queue__filter--active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="forum-mod-queue__toolbar-end">
          {lastRefreshAt && (
            <span className="forum-mod-queue__refreshed" aria-live="polite">
              更新於 {timeAgo(new Date(lastRefreshAt).toISOString())}
            </span>
          )}
          <button type="button" className="forum-mod-queue__refresh" onClick={loadQueue}>
            重新整理
          </button>
        </div>
      </div>

      {(localError) && (
        <p className="forum-mod-queue__error" role="alert">{localError}</p>
      )}

      {!queue && !localError && (
        <MoonLoading label="載入檢舉佇列…" variant="hero" className="page-loading" />
      )}

      {queue && totalPending === 0 && filter === 'all' && (
        <div className="forum-mod-queue__empty-hero" role="status">
          <span className="forum-mod-queue__empty-icon" aria-hidden="true">🌕</span>
          <p className="forum-mod-queue__empty-title">月夜寧靜</p>
          <p className="forum-mod-queue__empty">目前沒有待處理的檢舉。你可以稍後再回來看看。</p>
        </div>
      )}

      {queue && (totalPending > 0 || filter !== 'all') && (
        <div className="forum-mod-queue__sections">
          {visibleSections.posts && (
            <section className="forum-mod-queue__section">
              <h2 className="forum-mod-queue__heading">被檢舉貼文 ({posts.length})</h2>
              {posts.length === 0 ? (
                <p className="forum-mod-queue__empty forum-mod-queue__empty--inline">目前沒有待處理貼文。</p>
              ) : (
                <ul className="forum-mod-queue__list">
                  {posts.map((p) => (
                    <li key={p.id} className="forum-mod-queue__card">
                      <div className="forum-mod-queue__card-main">
                        <div className="forum-mod-queue__card-head">
                          <TopicBadge topic={p.topic} />
                          {p.report_count >= 5 && (
                            <span className="forum-mod-queue__status forum-mod-queue__status--urgent">⚠ 高檢舉</span>
                          )}
                          {p.visibility === 'hidden' && (
                            <span className="forum-mod-queue__status">🌑 夜幕降臨</span>
                          )}
                          {p.is_pinned && <span className="forum-mod-queue__status">📌 置頂</span>}
                          {p.is_highlighted && <span className="forum-mod-queue__status forum-mod-queue__status--crown">✨ 加冕</span>}
                        </div>
                        <p className="forum-mod-queue__title">{p.title || '（無標題）'}</p>
                        <p className="forum-mod-queue__preview">{p.preview}</p>
                        <p className="forum-mod-queue__meta">
                          檢舉 <strong>{p.report_count}</strong> 次 · {p.author_display_name || '—'} · {timeAgo(p.created_at)} ·{' '}
                          <Link href={p.forum_url} className="forum-mod-queue__link">前台查看</Link>
                        </p>
                      </div>
                      <div className="forum-mod-queue__actions">
                        {p.visibility !== 'hidden' ? (
                          <ActionButton
                            label="夜幕降臨"
                            title={ACTION_HINTS.hide}
                            disabled={!!busyId}
                            onClick={() => setConfirm({
                              method: 'POST',
                              path: `/api/forum/moderation/posts/${p.id}/hide`,
                              body: {},
                              showNote: true,
                              title: '夜幕降臨',
                              sub: '此帖將從前台隱藏，資料仍保留。你之後可以恢復月光。',
                              icon: '🌑',
                              confirmLabel: '確認夜幕降臨',
                              variant: 'default',
                            })}
                          />
                        ) : (
                          <ActionButton
                            label="恢復月光"
                            title={ACTION_HINTS.unhide}
                            variant="success"
                            disabled={!!busyId}
                            onClick={() => modAction('POST', `/api/forum/moderation/posts/${p.id}/unhide`)}
                          />
                        )}
                        <ActionButton
                          label={p.is_pinned ? '取消置頂' : '圍爐置頂'}
                          title={ACTION_HINTS.pin}
                          disabled={!!busyId}
                          onClick={() => modAction('POST', `/api/forum/moderation/posts/${p.id}/pin`, { pinned: !p.is_pinned })}
                        />
                        <ActionButton
                          label={p.is_highlighted ? '取消加冕' : '月光加冕'}
                          title={ACTION_HINTS.highlight}
                          disabled={!!busyId}
                          onClick={() => modAction('POST', `/api/forum/moderation/posts/${p.id}/highlight`, { highlighted: !p.is_highlighted })}
                        />
                        {canAdmin && (
                          <ActionButton
                            label="硬刪"
                            title={ACTION_HINTS.hardDelete}
                            variant="danger"
                            disabled={!!busyId}
                            onClick={() => setConfirm({
                              method: 'DELETE',
                              path: `/api/forum/moderation/posts/${p.id}`,
                              showNote: false,
                              title: '硬刪除此帖？',
                              sub: '此操作不可復原，僅在必要時使用。',
                              icon: '⚠️',
                              confirmLabel: '確認硬刪',
                              variant: 'danger',
                            })}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {visibleSections.comments && (
            <section className="forum-mod-queue__section">
              <h2 className="forum-mod-queue__heading">被檢舉留言 ({comments.length})</h2>
              {comments.length === 0 ? (
                <p className="forum-mod-queue__empty forum-mod-queue__empty--inline">目前沒有待處理留言。</p>
              ) : (
                <ul className="forum-mod-queue__list">
                  {comments.map((c) => (
                    <li key={c.id} className="forum-mod-queue__card forum-mod-queue__card--comment">
                      <p className="forum-mod-queue__preview">{c.preview}</p>
                      <p className="forum-mod-queue__meta">
                        檢舉 <strong>{c.report_count}</strong> 次 · {c.author_display_name || '—'} · {timeAgo(c.created_at)} ·{' '}
                        {c.is_hidden ? '🌑 已隱藏' : '可見'} ·{' '}
                        <Link href={c.forum_url} className="forum-mod-queue__link">查看</Link>
                      </p>
                      {!c.is_hidden && (
                        <div className="forum-mod-queue__actions">
                          <ActionButton
                            label="夜幕降臨"
                            title={ACTION_HINTS.hideComment}
                            disabled={!!busyId}
                            onClick={() => setConfirm({
                              method: 'POST',
                              path: `/api/forum/moderation/comments/${c.id}/hide`,
                              body: {},
                              showNote: true,
                              title: '夜幕降臨（留言）',
                              sub: '此留言將從前台隱藏，資料仍保留。',
                              icon: '🌑',
                              confirmLabel: '確認隱藏',
                              variant: 'default',
                            })}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
