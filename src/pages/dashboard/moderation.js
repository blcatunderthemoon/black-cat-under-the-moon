import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/dashboard/Layout';
import styles from '../../styles/dashboard/Moderation.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-HK', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ModerationPage() {
  const [tab,       setTab]       = useState('bottles');
  const [items,     setItems]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [msgType,   setMsgType]   = useState('ok');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await dashFetch(`/api/dashboard/moderation?action=${tab}&page=${page}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);

  async function doAction(action, type, id) {
    setActionMsg('');
    try {
      const res  = await dashFetch('/api/dashboard/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, type, id }),
      });
      const data = await res.json();
      if (data.success) {
        setMsgType('ok');
        setActionMsg(action === 'restore' ? `✓ 已恢復 (${id.slice(0, 8)}…)` : `✕ 已刪除 (${id.slice(0, 8)}…)`);
        load();
      } else {
        setMsgType('err');
        setActionMsg(`錯誤：${data.error}`);
      }
    } catch {
      setMsgType('err');
      setActionMsg('網路錯誤，請重試。');
    }
  }

  const switchTab = (t) => { setTab(t); setPage(1); setActionMsg(''); };

  return (
    <Layout title="內容審核">
      <div className={styles.wrap}>
        <h1 className={styles.title}>🛡️ 內容審核</h1>

        <div className={styles.tabs}>
          <button className={tab === 'bottles' ? styles.tabActive : styles.tab} onClick={() => switchTab('bottles')}>
            🍶 舉報瓶子
          </button>
          <button className={tab === 'replies' ? styles.tabActive : styles.tab} onClick={() => switchTab('replies')}>
            💬 舉報回聲
          </button>
        </div>

        {actionMsg && (
          <div className={msgType === 'ok' ? styles.msgOk : styles.msgErr}>{actionMsg}</div>
        )}

        {loading ? (
          <p className={styles.loading}>載入中…</p>
        ) : (
          <>
            <p className={styles.count}>共 {total} 筆待審核</p>

            <div className={styles.list}>
              {items.length === 0 && (
                <p className={styles.empty}>目前沒有待審核內容 ✨</p>
              )}
              {items.map((item) => (
                <div key={item.id} className={styles.card}>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardId}>{item.id.slice(0, 8)}…</span>
                    <span className={styles.cardDate}>{formatDate(item.created_at)}</span>
                    <span className={styles.cardReport}>⚑ {item.report_count ?? 0} 次舉報</span>
                  </div>
                  {tab === 'replies' && item.bottle_id && (
                    <div className={styles.cardSub}>所屬瓶子：{item.bottle_id.slice(0, 8)}…</div>
                  )}
                  {tab === 'bottles' && item.mood_tag && (
                    <div className={styles.cardSub}>心情：{item.mood_tag}</div>
                  )}
                  <div className={styles.cardContent}>{item.content}</div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.btnRestore}
                      onClick={() => doAction('restore', tab === 'bottles' ? 'bottle' : 'reply', item.id)}
                    >
                      ✓ 恢復
                    </button>
                    <button
                      className={styles.btnDelete}
                      onClick={() => {
                        if (!window.confirm('確定要永久刪除此內容？此操作不可還原。')) return;
                        doAction('delete', tab === 'bottles' ? 'bottle' : 'reply', item.id);
                      }}
                    >
                      ✕ 永久刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.pagination}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← 上頁</button>
              <span>第 {page} 頁</span>
              <button disabled={items.length < 50} onClick={() => setPage((p) => p + 1)}>下頁 →</button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
