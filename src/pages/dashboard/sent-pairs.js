import { useState, useCallback, useEffect } from 'react';
import Layout from '../../components/dashboard/Layout';
import MatchDetailPanel from '../../components/dashboard/MatchDetailPanel';
import styles from '../../styles/dashboard/SentPairs.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-HK', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function scoreColor(s) {
  if (s == null) return '#a89cc8';
  if (s >= 60) return '#4ade80';
  if (s >= 40) return '#fbbf24';
  return '#f87171';
}

export default function SentPairsPage() {
  // ── Filter state ──────────────────────────────────────────────────────
  const [filterUserId, setFilterUserId] = useState('');
  const [loading, setLoading]           = useState(false);
  const [pairs, setPairs]               = useState(null);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 50;

  // ── Preview state ─────────────────────────────────────────────────────
  const [previewAnchor, setPreviewAnchor]   = useState(null);
  const [previewMatch, setPreviewMatch]     = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);

  const handlePreview = useCallback(async (pair) => {
    setPreviewLoadingId(pair.id);
    try {
      const res = await dashFetch(`/api/dashboard/match-explorer?userId=${pair.user_a_id}&minScore=0`);
      const data = await res.json();
      if (!data.results) return;
      const matchResult = data.results.find((r) => Number(r.id) === Number(pair.user_b_id));
      if (matchResult) {
        setPreviewAnchor(data.user);
        setPreviewMatch(matchResult);
      }
    } catch {
      // silently ignore
    } finally {
      setPreviewLoadingId(null);
    }
  }, []);

  // ── Add-form state ────────────────────────────────────────────────────
  const [formA, setFormA]         = useState('');
  const [formB, setFormB]         = useState('');
  const [formScore, setFormScore] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [adding, setAdding]       = useState(false);
  const [addError, setAddError]   = useState('');

  // ── Fetch pairs ───────────────────────────────────────────────────────
  const fetchPairs = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, pageSize: PAGE_SIZE });
    if (filterUserId) params.set('userId', filterUserId);
    try {
      const res = await dashFetch(`/api/dashboard/sent-pairs?${params}`);
      const data = await res.json();
      setPairs(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch {
      setPairs([]);
    } finally {
      setLoading(false);
    }
  }, [filterUserId]);

  // Auto-load on mount
  useEffect(() => { fetchPairs(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => fetchPairs(1);

  const handleClear = () => {
    setFilterUserId('');
    setPairs(null);
    setTotal(0);
    setPage(1);
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('確認刪除此配對記錄？刪除後，相關用戶的配對結果將重新顯示此對象。')) return;
    await dashFetch(`/api/dashboard/sent-pairs?id=${id}`, { method: 'DELETE' });
    fetchPairs(page);
  };

  // ── Manual add ────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!formA || !formB) { setAddError('請填寫 User A ID 和 User B ID'); return; }
    if (Number(formA) === Number(formB)) { setAddError('兩個 ID 不能相同'); return; }
    setAdding(true);
    try {
      const res = await dashFetch('/api/dashboard/sent-pairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_a_id: Number(formA),
          user_b_id: Number(formB),
          match_score: formScore ? Number(formScore) : null,
          notes: formNotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setAddError(json.error || '新增失敗'); return; }
      setFormA(''); setFormB(''); setFormScore(''); setFormNotes('');
      fetchPairs(1);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Layout pageTitle="已發送配對" breadcrumb="儀表板 / 已發送配對">
      {/* ── Add Form ──────────────────────────────────────────────── */}
      <div className={styles.addCard}>
        <div className={styles.sectionTitle}>＋ 手動新增已發送配對</div>
        <form className={styles.addForm} onSubmit={handleAdd}>
          <div className={styles.addRow}>
            <div className={styles.addField}>
              <label className={styles.addLabel}>User A ID *</label>
              <input
                className={styles.addInput}
                type="number"
                placeholder="例：12"
                value={formA}
                onChange={(e) => setFormA(e.target.value)}
              />
            </div>
            <div className={styles.addField}>
              <label className={styles.addLabel}>User B ID *</label>
              <input
                className={styles.addInput}
                type="number"
                placeholder="例：34"
                value={formB}
                onChange={(e) => setFormB(e.target.value)}
              />
            </div>
            <div className={styles.addField}>
              <label className={styles.addLabel}>配對分數（選填）</label>
              <input
                className={styles.addInput}
                type="number"
                placeholder="0–100"
                min={0}
                max={100}
                value={formScore}
                onChange={(e) => setFormScore(e.target.value)}
              />
            </div>
            <div className={styles.addFieldWide}>
              <label className={styles.addLabel}>備註（選填）</label>
              <input
                className={styles.addInput}
                type="text"
                placeholder="例：已 WhatsApp 聯絡"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
            <button className={styles.addBtn} type="submit" disabled={adding}>
              {adding ? '新增中…' : '新增'}
            </button>
          </div>
          {addError && <div className={styles.addError}>{addError}</div>}
        </form>
      </div>

      {/* ── Filter ────────────────────────────────────────────────── */}
      <div className={styles.filterBar}>
        <div className={styles.filterLeft}>
          <label className={styles.filterLabel}>按用戶 ID 篩選</label>
          <input
            className={styles.filterInput}
            type="number"
            placeholder="User ID（空白 = 全部）"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className={styles.filterActions}>
          <button className={styles.searchBtn} onClick={handleSearch} disabled={loading}>
            {loading ? '查詢中…' : '查詢'}
          </button>
          <button className={styles.clearBtn} onClick={handleClear}>清除</button>
        </div>
        {pairs !== null && (
          <div className={styles.totalBadge}>共 {total} 條記錄</div>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className={styles.tableCard}>
        {pairs === null ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>✉️</span>
            按「查詢」載入已發送配對記錄
          </div>
        ) : pairs.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🌙</span>
            暫無記錄
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User A</th>
                    <th>User B</th>
                    <th>配對分數</th>
                    <th>發送時間</th>
                    <th>備註</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((pair) => {
                    const a = pair.user_a || {};
                    const b = pair.user_b || {};
                    return (
                      <tr key={pair.id} className={styles.tableRow}>
                        <td className={styles.idCell}>{pair.id}</td>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>{a.name || '—'}</span>
                            <span className={styles.userMeta}>
                              #{pair.user_a_id}
                              {a.identity ? ` · ${a.identity}` : ''}
                              {a.age ? ` · ${a.age}歲` : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>{b.name || '—'}</span>
                            <span className={styles.userMeta}>
                              #{pair.user_b_id}
                              {b.identity ? ` · ${b.identity}` : ''}
                              {b.age ? ` · ${b.age}歲` : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          {pair.match_score != null ? (
                            <span
                              className={styles.scoreBadge}
                              style={{ color: scoreColor(pair.match_score) }}
                            >
                              {pair.match_score}
                            </span>
                          ) : (
                            <span className={styles.na}>—</span>
                          )}
                        </td>
                        <td className={styles.dateCell}>{formatDate(pair.sent_at)}</td>
                        <td className={styles.notesCell}>{pair.notes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className={styles.previewBtn}
                              disabled={previewLoadingId === pair.id}
                              onClick={() => handlePreview(pair)}
                            >
                              {previewLoadingId === pair.id ? '載入…' : '預覽'}
                            </button>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(pair.id)}
                            >
                              刪除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  disabled={page <= 1}
                  onClick={() => fetchPairs(page - 1)}
                >
                  ‹ 上一頁
                </button>
                <span className={styles.pageInfo}>{page} / {totalPages}</span>
                <button
                  className={styles.pageBtn}
                  disabled={page >= totalPages}
                  onClick={() => fetchPairs(page + 1)}
                >
                  下一頁 ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {previewMatch && previewAnchor && (
        <MatchDetailPanel
          user={previewAnchor}
          match={previewMatch}
          onClose={() => { setPreviewMatch(null); setPreviewAnchor(null); }}
        />
      )}
    </Layout>
  );
}
