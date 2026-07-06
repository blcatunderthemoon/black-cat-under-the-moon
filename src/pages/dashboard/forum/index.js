/**
 * /dashboard/forum — station moderation queue (DASHBOARD_SECRET)
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import Layout from '../../../components/dashboard/Layout';
import ForumDashboardNav from '../../../components/dashboard/ForumDashboardNav';
import { dashboardFetch } from '../../../lib/dashboard-fetch.js';
import MoonLoading from '../../../components/MoonLoading.js';

function ActionButton({ label, onClick, disabled, variant = 'default' }) {
  const bg = variant === 'danger' ? '#c44569' : variant === 'success' ? '#2d6a4f' : '#7c5cfc';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: 'none',
        background: bg,
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

export default function DashboardForumPage() {
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const loadQueue = useCallback(async () => {
    setError('');
    try {
      const res = await dashboardFetch('/api/forum/moderation/queue');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '載入失敗');
        setQueue({ posts: [], comments: [] });
        return;
      }
      setQueue(data);
    } catch {
      setError('無法連線至檢舉佇列');
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function modAction(method, path, body) {
    setBusyId(path);
    try {
      const res = await dashboardFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '操作失敗');
      } else {
        await loadQueue();
      }
    } catch {
      setError('操作失敗');
    } finally {
      setBusyId(null);
    }
  }

  const posts = queue?.posts || [];
  const comments = queue?.comments || [];

  return (
    <Layout pageTitle="月光圍爐治理" breadcrumb="儀表板 / 月光圍爐 / 檢舉佇列">
      <Head>
        <title>月光圍爐治理 · Dashboard</title>
      </Head>
      <ForumDashboardNav />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          type="button"
          onClick={loadQueue}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #3d3a5c', background: 'transparent', color: '#e8e3f5', cursor: 'pointer', fontSize: 13 }}
        >
          重新整理
        </button>
      </div>

      {error && (
        <p style={{ color: '#ff6b9d', fontSize: 14, marginBottom: 16 }} role="alert">{error}</p>
      )}

      {!queue && !error && (
        <MoonLoading label="載入中…" variant="hero" className="page-loading" />
      )}

      {queue && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <section>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>被檢舉貼文 ({posts.length})</h2>
              {posts.length === 0 ? (
                <p style={{ color: '#9490b0', fontSize: 14 }}>目前沒有待處理貼文。</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {posts.map((p) => (
                    <li
                      key={p.id}
                      style={{ background: '#0b0d22', border: '1px solid #1d2055', borderRadius: 10, padding: 16 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <p style={{ margin: '0 0 4px', fontWeight: 700 }}>
                            {p.title || p.topic || '（無標題）'}
                            {p.visibility === 'hidden' && (
                              <span style={{ marginLeft: 8, fontSize: 12, color: '#9490b0' }}>🌑 夜幕降臨</span>
                            )}
                          </p>
                          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#b8b4d0', lineHeight: 1.5 }}>{p.preview}</p>
                          <p style={{ margin: 0, fontSize: 12, color: '#6e6a88' }}>
                            檢舉 {p.report_count} 次 · {p.author_display_name || '—'} ·{' '}
                            <Link href={p.forum_url} style={{ color: '#7c5cfc' }}>前台查看</Link>
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
                          {p.visibility !== 'hidden' ? (
                            <ActionButton
                              label="夜幕降臨"
                              disabled={!!busyId}
                              onClick={() => modAction('POST', `/api/forum/moderation/posts/${p.id}/hide`, {})}
                            />
                          ) : (
                            <ActionButton
                              label="恢復月光"
                              variant="success"
                              disabled={!!busyId}
                              onClick={() => modAction('POST', `/api/forum/moderation/posts/${p.id}/unhide`)}
                            />
                          )}
                          <ActionButton
                            label={p.is_pinned ? '取消置頂' : '置頂'}
                            disabled={!!busyId}
                            onClick={() => modAction('POST', `/api/forum/moderation/posts/${p.id}/pin`, { pinned: !p.is_pinned })}
                          />
                          <ActionButton
                            label={p.is_highlighted ? '取消加冕' : '月光加冕'}
                            disabled={!!busyId}
                            onClick={() => modAction('POST', `/api/forum/moderation/posts/${p.id}/highlight`, { highlighted: !p.is_highlighted })}
                          />
                          <ActionButton
                            label="硬刪"
                            variant="danger"
                            disabled={!!busyId}
                            onClick={() => {
                              if (!window.confirm('確定硬刪除此帖？此操作不可復原。')) return;
                              modAction('DELETE', `/api/forum/moderation/posts/${p.id}`);
                            }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>被檢舉留言 ({comments.length})</h2>
              {comments.length === 0 ? (
                <p style={{ color: '#9490b0', fontSize: 14 }}>目前沒有待處理留言。</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {comments.map((c) => (
                    <li
                      key={c.id}
                      style={{ background: '#0b0d22', border: '1px solid #1d2055', borderRadius: 10, padding: 16 }}
                    >
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#b8b4d0' }}>{c.preview}</p>
                      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6e6a88' }}>
                        檢舉 {c.report_count} 次 · {c.is_hidden ? '🌑 已隱藏' : '可見'} ·{' '}
                        <Link href={c.forum_url} style={{ color: '#7c5cfc' }}>查看</Link>
                      </p>
                      {!c.is_hidden && (
                        <ActionButton
                          label="隱藏留言"
                          disabled={!!busyId}
                          onClick={() => modAction('POST', `/api/forum/moderation/comments/${c.id}/hide`, {})}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
      )}
    </Layout>
  );
}
