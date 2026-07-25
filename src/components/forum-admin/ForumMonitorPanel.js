/**
 * Shared forum content monitor panel (dashboard + website admin).
 */

import { useState, useEffect, useCallback } from 'react';
import LoadingText from '../LoadingText.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ForumMonitorPanel({ apiFetch }) {
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [threshold, setThreshold] = useState(3);
  const [showHidden, setShowHidden] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: typeFilter,
        threshold,
        hidden: showHidden ? '1' : '0',
        limit,
        offset: (page - 1) * limit,
      });
      const r = await apiFetch(`/api/dashboard/forum-monitor?${params}`);
      const data = await r.json();
      setPosts(data.posts || []);
      setComments(data.comments || []);
      setTotal(data.total || 0);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [page, threshold, showHidden, typeFilter, apiFetch]);

  useEffect(() => { load(); }, [load]);

  async function doAction(targetType, targetId, action) {
    setMsg('');
    try {
      const r = await apiFetch('/api/dashboard/forum-monitor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, action }),
      });
      const data = await r.json();
      if (data.success) {
        setMsgOk(true);
        setMsg(`✓ 已${action === 'hide' ? '隱藏' : '恢復'} (${targetId.slice(0, 8)}…)`);
        load();
      } else {
        setMsgOk(false);
        setMsg(`錯誤：${data.error}`);
      }
    } catch { setMsgOk(false); setMsg('網路錯誤，請重試。'); }
  }

  const pages = Math.ceil(total / limit);

  return (
    <div className="forum-admin-monitor">
        <div className="forum-admin-monitor__toolbar">
          <label className="forum-admin-monitor__field">
            <span className="forum-admin-monitor__field-label">類型</span>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="forum-admin-monitor__select"
            >
              <option value="all">全部</option>
              <option value="post">貼文</option>
              <option value="comment">留言</option>
            </select>
          </label>
          <label className="forum-admin-monitor__field">
            <span className="forum-admin-monitor__field-label">檢舉門檻 ≥</span>
            <input
              type="number" min={1} max={99} value={threshold}
              onChange={e => { setThreshold(Number(e.target.value)); setPage(1); }}
              className="forum-admin-monitor__input forum-admin-monitor__input--num"
            />
          </label>
          <label className="forum-admin-monitor__checkbox">
            <input
              type="checkbox" checked={showHidden}
              onChange={e => { setShowHidden(e.target.checked); setPage(1); }}
            />
            顯示已隱藏
          </label>
          <button type="button" onClick={() => { setPage(1); load(); }} className="forum-admin-monitor__refresh">重新整理</button>
        </div>

        {msg && (
          <div className={`forum-admin-monitor__msg${msgOk ? ' forum-admin-monitor__msg--ok' : ' forum-admin-monitor__msg--err'}`}>
            {msg}
          </div>
        )}

        <div className="forum-admin-monitor__summary">
          共 {total} 筆
          {loading ? <LoadingText as="span" className="forum-admin-monitor__loading-label" /> : null}
        </div>

        {/* Posts */}
        {(typeFilter === 'all' || typeFilter === 'post') && posts.length > 0 && (
          <section className="forum-admin-monitor__section">
            <h2 className="forum-admin-monitor__section-title">貼文 ({posts.length})</h2>
            {posts.map(post => (
              <div key={post.id} className="forum-admin-monitor__card">
                <div className="forum-admin-monitor__card-head">
                  <span className="forum-admin-monitor__badge">貼文</span>
                  <span className="forum-admin-monitor__report">⚑ {post.report_count}</span>
                  <span className="forum-admin-monitor__topic">{post.topic}</span>
                  <span className="forum-admin-monitor__author">{post.anonymous_name_snapshot || '神秘貓咪'}</span>
                  <span className="forum-admin-monitor__time">{formatDate(post.created_at)}</span>
                  <span className={`forum-admin-monitor__status${post.visibility === 'hidden' ? ' forum-admin-monitor__status--hidden' : ''}`}>
                    {post.visibility === 'hidden' ? '已隱藏' : post.visibility}
                  </span>
                </div>
                {post.title && <div className="forum-admin-monitor__post-title">{post.title}</div>}
                <p className="forum-admin-monitor__preview">{post.content_preview}{post.content_preview?.length >= 120 ? '…' : ''}</p>
                <div className="forum-admin-monitor__actions">
                  {post.visibility !== 'hidden' ? (
                    <button type="button" onClick={() => doAction('post', post.id, 'hide')} className="forum-admin-monitor__hide-btn">隱藏</button>
                  ) : (
                    <button type="button" onClick={() => doAction('post', post.id, 'restore')} className="forum-admin-monitor__restore-btn">恢復</button>
                  )}
                  <span className="forum-admin-monitor__id">{post.id.slice(0, 12)}…</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Comments */}
        {(typeFilter === 'all' || typeFilter === 'comment') && comments.length > 0 && (
          <section className="forum-admin-monitor__section forum-admin-monitor__section--comments">
            <h2 className="forum-admin-monitor__section-title">留言 ({comments.length})</h2>
            {comments.map(comment => (
              <div key={comment.id} className="forum-admin-monitor__card">
                <div className="forum-admin-monitor__card-head">
                  <span className="forum-admin-monitor__badge forum-admin-monitor__badge--comment">留言</span>
                  <span className="forum-admin-monitor__report">⚑ {comment.report_count}</span>
                  <span className="forum-admin-monitor__time">{formatDate(comment.created_at)}</span>
                  <span className={`forum-admin-monitor__status${comment.is_hidden ? ' forum-admin-monitor__status--hidden' : ''}`}>
                    {comment.is_hidden ? '已隱藏' : '顯示中'}
                  </span>
                </div>
                <p className="forum-admin-monitor__preview">{comment.content_preview}{comment.content_preview?.length >= 120 ? '…' : ''}</p>
                <div className="forum-admin-monitor__actions">
                  {!comment.is_hidden ? (
                    <button type="button" onClick={() => doAction('comment', comment.id, 'hide')} className="forum-admin-monitor__hide-btn">隱藏</button>
                  ) : (
                    <button type="button" onClick={() => doAction('comment', comment.id, 'restore')} className="forum-admin-monitor__restore-btn">恢復</button>
                  )}
                  <a href={`/forum/${comment.post_id}`} target="_blank" rel="noopener noreferrer" className="forum-admin-monitor__view-link">查看原文</a>
                  <span className="forum-admin-monitor__id">{comment.id.slice(0, 12)}…</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {posts.length === 0 && comments.length === 0 && !loading && (
          <p className="forum-admin-monitor__empty">目前沒有符合條件的內容。</p>
        )}

        {pages > 1 && (
          <div className="forum-admin-monitor__pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="forum-admin-monitor__page-btn">← 上一頁</button>
            <span className="forum-admin-monitor__page-info">{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="forum-admin-monitor__page-btn">下一頁 →</button>
          </div>
        )}
    </div>
  );
}
