import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/dashboard/Layout';
import styles from '../../styles/dashboard/TestData.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const IDENTITY_CLASS = {
  TB:       styles.identityTagTB,
  TBG:      styles.identityTagTBG,
  Pure:     styles.identityTagPure,
  Bi:       styles.identityTagBi,
  'No Label': styles.identityTag,
};

const CLEAR_SQL = `DELETE FROM responses\nWHERE feedback LIKE 'Seed user%';`;

export default function TestDataPage() {
  const [seedCount, setSeedCount] = useState(null);
  const [count, setCount] = useState(20);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [result, setResult] = useState(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  function copySql() {
    navigator.clipboard.writeText(CLEAR_SQL).then(() => {
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    });
  }

  const fetchCount = useCallback(async () => {
    try {
      const res = await dashFetch('/api/dashboard/seed');
      const data = await res.json();
      setSeedCount(data.count ?? 0);
    } catch {
      setSeedCount('—');
    }
  }, []);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  async function handleSeed() {
    setLoadingSeed(true);
    setResult(null);
    try {
      const res = await dashFetch('/api/dashboard/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed', count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成失敗');
      setResult({ type: 'seed', ...data });
      await fetchCount();
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setLoadingSeed(false);
    }
  }

  // Clear is SQL-only — no API call needed

  return (
    <Layout title="資料管理">
      <div className={styles.page}>

        {/* ── stats bar ── */}
        <div className={styles.statsBar}>
          <span className={styles.statsLabel}>現有測試用戶</span>
          <span className={styles.countBadge}>
            {seedCount === null ? '…' : seedCount}
          </span>
          <span className={styles.statsLabel}>人</span>
          <button className={styles.refreshBtn} onClick={fetchCount}>
            ↻ 重新整理
          </button>
        </div>

        {/* ── seed control card ── */}
        <div className={styles.controlCard}>
          <p className={styles.cardTitle}>生成測試資料</p>
          <p className={styles.cardDesc}>
            系統會自動生成具有完整問卷答案的虛擬用戶，涵蓋 TB / TBG / Pure / Bi / No Label 五種身份。
            所有測試用戶的 feedback 欄位以「Seed user」開頭，可隨時一鍵清除。
          </p>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <span className={styles.inputLabel}>數量</span>
              <input
                type="number"
                className={styles.input}
                value={count}
                min={5}
                max={100}
                onChange={(e) => setCount(Math.max(5, Math.min(100, Number(e.target.value) || 20)))}
              />
              <span className={styles.inputLabel}>人 (5–100)</span>
            </div>
            <button
              className={styles.primaryBtn}
              onClick={handleSeed}
              disabled={loadingSeed}
            >
              {loadingSeed ? '生成中…' : '⊕ 生成測試資料'}
            </button>
          </div>
        </div>

        {/* ── clear control card ── */}
        <div className={styles.controlCard}>
          <p className={styles.cardTitle}>清除測試資料</p>
          <p className={styles.cardDesc}>
            複製以下 SQL，前往 Supabase Dashboard → SQL Editor 貼上並執行。只會刪除 feedback 以「Seed user」開頭的記錄，不影響真實用戶資料。
          </p>
          <div className={styles.sqlPanel}>
            <pre className={styles.sqlCode}>{CLEAR_SQL}</pre>
            <button className={styles.sqlCopyBtn} onClick={copySql}>
              {sqlCopied ? '✓ 已複製' : '複製 SQL'}
            </button>
          </div>
        </div>

        {/* ── result box ── */}
        {result && (
          <div className={styles.resultBox}>
            {result.type === 'seed' && (
              <>
                <div className={styles.resultHeader}>
                  <div className={styles.resultDot} />
                  成功生成 {result.inserted} 個測試用戶
                </div>
                {result.mix && (
                  <div className={styles.mixRow}>
                    {Object.entries(result.mix).map(([id, n]) => (
                      <span key={id} className={IDENTITY_CLASS[id] || styles.identityTag}>
                        {id} × {n}
                      </span>
                    ))}
                  </div>
                )}
                {result.sample && result.sample.length > 0 && (
                  <div className={styles.sampleList}>
                    {result.sample.map((u) => (
                      <div key={u.id} className={styles.sampleRow}>
                        <span className={styles.sampleName}>{u.name}</span>
                        <span className={IDENTITY_CLASS[u.identity] || styles.identityTag}>
                          {u.identity}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 'auto' }}>
                          #{u.id}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {result.type === 'clear' && (
              <div className={styles.resultHeader}>
                <div className={styles.resultDotDanger} />
                已清除 {result.deleted} 個測試用戶
              </div>
            )}

            {result.type === 'error' && (
              <div className={styles.resultHeader} style={{ color: 'var(--error, #f87171)' }}>
                ✕ 發生錯誤：{result.message}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
