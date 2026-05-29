import { useState, useCallback } from 'react';
import Layout from '../../components/dashboard/Layout';
import styles from '../../styles/dashboard/EmailAutomation.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const DIM_KEYS = ['attraction', 'emotional', 'lifestyle', 'communication', 'relationship', 'conflictSafety'];
const DIM_LABELS = ['🔥 火花', '💞 情感', '📅 步調', '💬 溝通', '💑 期望', '🛡️ 安全感'];

function scoreColor(s) {
  if (s == null) return '#a89cc8';
  if (s >= 60) return '#4ade80';
  if (s >= 40) return '#fbbf24';
  return '#f87171';
}

/** Derive the stable pair key used as checkbox map key */
function pairKey(p) {
  return `${p.user_a_id}:${p.user_b_id}`;
}

export default function EmailAutomationPage() {
  // ── Filter ────────────────────────────────────────────────────────────────
  const [minScore, setMinScore] = useState('60');
  const [loadingPairs, setLoadingPairs] = useState(false);

  // ── Pairs data ────────────────────────────────────────────────────────────
  const [pairs, setPairs] = useState(null);       // null = not loaded yet
  const [pairsTotal, setPairsTotal] = useState(0);
  const [showSent, setShowSent] = useState(false);

  // ── Drafts data ───────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // ── Checkbox state ────────────────────────────────────────────────────────
  const [checked, setChecked] = useState({});     // { "aId:bId": true }

  // ── Action state ──────────────────────────────────────────────────────────
  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending]         = useState(false);
  const [sendResults, setSendResults] = useState(null);   // per-pair result map

  // ── Draft-row send/delete state ───────────────────────────────────────────
  const [draftActionId, setDraftActionId] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch helpers
  // ─────────────────────────────────────────────────────────────────────────

  const fetchPairs = useCallback(async () => {
    setLoadingPairs(true);
    setChecked({});
    setSendResults(null);
    try {
      const params = new URLSearchParams({ mode: 'pairs', minScore: minScore || '0' });
      const res  = await dashFetch(`/api/dashboard/email-automation?${params}`);
      const data = await res.json();
      setPairs(data.pairs || []);
      setPairsTotal(data.total || 0);
    } catch {
      setPairs([]);
    } finally {
      setLoadingPairs(false);
    }
  }, [minScore]);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res  = await dashFetch('/api/dashboard/email-automation?mode=drafts');
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch {
      setDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  // Load both on first render
  const initialLoad = useCallback(() => {
    fetchPairs();
    fetchDrafts();
  }, [fetchPairs, fetchDrafts]);

  // ─────────────────────────────────────────────────────────────────────────
  // Checkbox helpers
  // ─────────────────────────────────────────────────────────────────────────

  const toggleRow = (key) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectAll = () => {
    const next = {};
    visiblePairs.forEach((p) => { next[pairKey(p)] = true; });
    setChecked(next);
  };

  const deselectAll = () => setChecked({});

  const visiblePairs = (pairs || []).filter((p) => showSent || !p.already_sent);
  const selectedPairs = visiblePairs.filter((p) => checked[pairKey(p)]);
  const selectedCount = selectedPairs.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Save draft
  // ─────────────────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!selectedCount) return;
    setSavingDraft(true);
    try {
      const payload = selectedPairs.map((p) => ({
        userAId:         p.user_a_id,
        userBId:         p.user_b_id,
        match_score:     p.match_score,
        score_breakdown: p.score_breakdown || null,
      }));
      const res  = await dashFetch('/api/dashboard/create-gmail-drafts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pairs: payload }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`存入 Gmail 草稿失敗：${data.error}\n${data.hint || ''}`); return; }
      await Promise.all([fetchPairs(), fetchDrafts()]);
      setChecked({});
    } finally {
      setSavingDraft(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Send emails (for selected pairs OR a specific draft pair)
  // ─────────────────────────────────────────────────────────────────────────

  const doSend = async (pairsToSend) => {
    setSending(true);
    setSendResults(null);
    try {
      const payload = pairsToSend.map((p) => ({
        userAId:         p.user_a_id ?? p.userAId,
        userBId:         p.user_b_id ?? p.userBId,
        match_score:     p.match_score,
        score_breakdown: p.score_breakdown || null,
      }));
      const res  = await dashFetch('/api/dashboard/send-emails', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pairs: payload }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`發送失敗：${data.error || res.status}\n${data.hint || ''}`);
        return;
      }

      // Build a result map keyed by normalised pair key for inline display
      const resultMap = {};
      for (const r of data.results || []) {
        const [a, b] = r.userAId <= r.userBId ? [r.userAId, r.userBId] : [r.userBId, r.userAId];
        resultMap[`${a}:${b}`] = r;
      }
      setSendResults(resultMap);

      // Refresh data
      await Promise.all([fetchPairs(), fetchDrafts()]);
      setChecked({});
    } finally {
      setSending(false);
    }
  };

  const handleSendSelected = () => {
    if (!selectedCount) return;
    if (!confirm(`確認發送 ${selectedCount} 對配對通知郵件？此操作不可撤回。`)) return;
    doSend(selectedPairs);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Draft actions
  // ─────────────────────────────────────────────────────────────────────────

  const handleDeleteDraft = async (draft) => {
    if (!confirm(`確認刪除此草稿？`)) return;
    setDraftActionId(draft.id);
    try {
      await dashFetch(`/api/dashboard/email-automation?draftId=${draft.id}`, { method: 'DELETE' });
      await fetchDrafts();
    } finally {
      setDraftActionId(null);
    }
  };

  const handleSendDraft = async (draft) => {
    if (!confirm(`確認發送此草稿配對通知郵件？`)) return;
    setDraftActionId(draft.id);
    try {
      await doSend([{ user_a_id: draft.user_a_id, user_b_id: draft.user_b_id, match_score: draft.match_score }]);
    } finally {
      setDraftActionId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  function renderSendStatus(key) {
    if (!sendResults) return null;
    const r = sendResults[key];
    if (!r) return null;
    if (r.error) return <span className={`${styles.badge} ${styles.badgeError}`}>❌ 失敗</span>;
    // Draft result
    if (r.draftsCreated) {
      const allOk = r.draftsCreated.every((d) => d.saved || d.skipped);
      return allOk
        ? <span className={`${styles.badge} ${styles.badgeDraft}`}>📝 Gmail 草稿已建立</span>
        : <span className={`${styles.badge} ${styles.badgeError}`}>⚠ 部分失敗</span>;
    }
    // Send result
    const allOk = r.deliveries?.every((d) => d.delivered || d.skipped);
    return allOk
      ? <span className={`${styles.badge} ${styles.badgeSuccess}`}>✅ 已送出</span>
      : <span className={`${styles.badge} ${styles.badgeError}`}>⚠ 部分失敗</span>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Layout pageTitle="郵件自動化" breadcrumb="儀表板 / 郵件自動化">
      <div className={styles.page}>

        {/* ── Filter bar ─────────────────────────────────────────────────── */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>最低配對分數（0–100）</label>
            <input
              className={styles.filterInput}
              type="number"
              min={0}
              max={100}
              placeholder="例：60"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && initialLoad()}
            />
          </div>
          <button
            className={styles.loadBtn}
            onClick={initialLoad}
            disabled={loadingPairs}
          >
            {loadingPairs ? '計算中…' : '載入配對'}
          </button>
        </div>

        {/* ── Global pairs table ─────────────────────────────────────────── */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>全域配對清單</span>
            <div className={styles.bulkToolbar}>
              {pairs !== null && visiblePairs.length > 0 && (
                <>
                  <button className={styles.selectAllBtn} onClick={selectAll}>全選</button>
                  <button className={styles.selectAllBtn} onClick={deselectAll}>取消全選</button>
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showSent}
                  onChange={(e) => setShowSent(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                顯示已發送
              </label>
              {pairs !== null && (
                <span className={styles.countBadge}>
                  {visiblePairs.length}{!showSent && pairs.some(p => p.already_sent) ? ` / ${pairsTotal}` : ''} 對
                </span>
              )}
            </div>
          </div>

          <div className={styles.tableWrap}>
            {pairs === null ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🌙</span>
                設定分數門檻後點擊「載入配對」以查看所有符合條件的配對
              </div>
            ) : visiblePairs.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🔍</span>
                {pairs.length > 0 ? '所有配對均已發送 — 勾選「顯示已發送」可查看' : '此分數門檻下暫無配對結果'}
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th></th>
                    <th>用戶 A</th>
                    <th>用戶 B</th>
                    <th>智能分</th>
                    {DIM_LABELS.map((l) => <th key={l}>{l}</th>)}
                    <th>狀態</th>
                    <th>發送結果</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePairs.map((p) => {
                    const key   = pairKey(p);
                    const isChk = !!checked[key];
                    const b     = p.score_breakdown || {};
                    return (
                      <tr
                        key={key}
                        className={`${styles.tableRow} ${isChk ? styles.checked : ''}`}
                        onClick={() => toggleRow(key)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={isChk}
                            onChange={() => toggleRow(key)}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {p.user_a?.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({p.user_a?.identity})</span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {p.user_b?.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({p.user_b?.identity})</span>
                        </td>
                        <td>
                          <span className={styles.scoreBadge} style={{ color: scoreColor(p.match_score) }}>
                            {p.match_score}
                          </span>
                        </td>
                        {DIM_KEYS.map((k) => (
                          <td key={k} className={styles.dimScore}>{b[k] ?? '—'}</td>
                        ))}
                        <td>
                          {p.already_sent && (
                            <span className={`${styles.badge} ${styles.badgeSent}`}>✉ 已發送</span>
                          )}
                          {!p.already_sent && p.in_draft && (
                            <span className={`${styles.badge} ${styles.badgeDraft}`}>📝 草稿</span>
                          )}
                        </td>
                        <td>{renderSendStatus(key)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Draft queue ────────────────────────────────────────────────── */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>草稿佇列</span>
            {drafts !== null && (
              <span className={styles.countBadge}>{drafts.length} 個草稿</span>
            )}
          </div>

          <div className={styles.tableWrap}>
            {drafts === null ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📝</span>
                {loadingDrafts ? '載入中…' : '點擊「載入配對」以同步草稿'}
              </div>
            ) : drafts.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>✨</span>
                草稿佇列是空的 — 從上方選取配對後點擊「存入草稿」
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>用戶 A</th>
                    <th>用戶 B</th>
                    <th>配對分數</th>
                    <th>建立時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => {
                    const dKey = `${Math.min(d.user_a_id, d.user_b_id)}:${Math.max(d.user_a_id, d.user_b_id)}`;
                    const busy = draftActionId === d.id || sending;
                    return (
                      <tr key={d.id} className={styles.tableRow}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {d.user_a?.name ?? `ID ${d.user_a_id}`}
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                            {d.user_a?.identity ? ` (${d.user_a.identity})` : ''}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {d.user_b?.name ?? `ID ${d.user_b_id}`}
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                            {d.user_b?.identity ? ` (${d.user_b.identity})` : ''}
                          </span>
                        </td>
                        <td>
                          <span className={styles.scoreBadge} style={{ color: scoreColor(d.match_score) }}>
                            {d.match_score ?? '—'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {d.created_at
                            ? new Date(d.created_at).toLocaleString('zh-HK', {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td>
                          <button
                            className={styles.draftSendBtn}
                            onClick={() => handleSendDraft(d)}
                            disabled={busy}
                          >
                            {draftActionId === d.id && sending ? '發送中…' : '✉ 立即發送'}
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteDraft(d)}
                            disabled={busy}
                          >
                            刪除
                          </button>
                          {renderSendStatus(dKey)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* ── Floating action bar ───────────────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className={styles.floatingBar}>
          <span className={styles.floatingBarLabel}>已選 {selectedCount} 對</span>
          <button
            className={styles.draftBtn}
            onClick={handleSaveDraft}
            disabled={savingDraft || sending}
          >
            {savingDraft ? '建立中…' : '📝 存入 Gmail 草稿'}
          </button>
          <button
            className={styles.sendBtn}
            onClick={handleSendSelected}
            disabled={sending || savingDraft}
          >
            {sending ? '發送中…' : '✉ 立即發送'}
          </button>
        </div>
      )}
    </Layout>
  );
}
