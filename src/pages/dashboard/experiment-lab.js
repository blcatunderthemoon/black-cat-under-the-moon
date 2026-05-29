import { useState } from 'react';
import Layout from '../../components/dashboard/Layout';
import styles from '../../styles/dashboard/ExperimentLab.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const DEFAULT_WEIGHTS = { attraction: 1, emotional: 1, lifestyle: 1, communication: 1, relationship: 1, conflictSafety: 1 };

const WEIGHT_DIMS = [
  { key: 'attraction',     label: '🔥 身體吸引力', color: '#f97316' },
  { key: 'emotional',      label: '💞 情感共鳴',   color: '#ec4899' },
  { key: 'lifestyle',      label: '📅 生活步調',   color: '#34d399' },
  { key: 'communication',  label: '💬 溝通與三觀', color: '#a78bfa' },
  { key: 'relationship',   label: '💑 關係期待',   color: '#5b8af0' },
  { key: 'conflictSafety', label: '🛡 相處安全感', color: '#fb923c' },
];

function DeltaBadge({ delta, isNew }) {
  if (isNew) return <span className={`${styles.deltaBadge} ${styles.deltaNew}`}>新</span>;
  if (delta === null || delta === undefined) return null;
  if (delta === 0) return <span className={`${styles.deltaBadge} ${styles.deltaNone}`}>—</span>;
  if (delta > 0) return <span className={`${styles.deltaBadge} ${styles.deltaUp}`}>▲{delta}</span>;
  return <span className={`${styles.deltaBadge} ${styles.deltaDown}`}>▼{Math.abs(delta)}</span>;
}

export default function ExperimentLabPage() {
  const [userId, setUserId] = useState('');
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [useHardFilter, setUseHardFilter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const setWeight = (key, val) => setWeights((w) => ({ ...w, [key]: val }));

  const run = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await dashFetch('/api/dashboard/experiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId), weights, useHardFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '執行失敗');
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setResults(null);
    setError('');
  };

  const maxLen = results
    ? Math.max(results.original?.length || 0, results.modified?.length || 0)
    : 0;

  return (
    <Layout pageTitle="實驗室" breadcrumb="儀表板 / 實驗室">
      <div className={styles.layout}>
        {/* Controls */}
        <div className={styles.controlsPanel}>
          <div className={styles.panelTitle}>調整參數</div>

          <div className={styles.formGroup}>
            <label className={styles.label}>用戶 ID *</label>
            <input
              className={styles.input}
              type="number"
              placeholder="輸入錨點用戶 ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>

          {/* Weight sliders */}
          {WEIGHT_DIMS.map((d) => (
            <div key={d.key} className={styles.weightRow}>
              <div className={styles.weightHeader}>
                <span className={styles.weightLabel}>{d.label}</span>
                <span className={styles.weightValue}>{weights[d.key].toFixed(1)}×</span>
              </div>
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={weights[d.key]}
                style={{
                  background: `linear-gradient(to right, ${d.color} ${(weights[d.key]/3)*100}%, rgba(255,255,255,0.08) 0)`,
                }}
                onChange={(e) => setWeight(d.key, Number(e.target.value))}
              />
            </div>
          ))}

          {/* Hard filter toggle */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>篩選模式</span>
            <div className={styles.toggle}>
              <button
                className={`${styles.toggleOption} ${useHardFilter ? styles.active : ''}`}
                onClick={() => setUseHardFilter(true)}
              >
                Hard Filter
              </button>
              <button
                className={`${styles.toggleOption} ${!useHardFilter ? styles.active : ''}`}
                onClick={() => setUseHardFilter(false)}
              >
                Soft
              </button>
            </div>
          </div>

          <button className={styles.runBtn} onClick={run} disabled={!userId || loading}>
            {loading ? '計算中…' : '▶ 執行'}
          </button>
          <button className={styles.resetBtn} onClick={reset}>重置參數</button>

          {error && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--error)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className={styles.resultsPanel}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsTitle}>排名對比</span>
            <div className={styles.legend}>
              <span><span className={styles.legendDot} style={{ background: '#4ade80' }} />▲ 名次上升</span>
              <span><span className={styles.legendDot} style={{ background: '#f87171' }} />▼ 名次下降</span>
              <span><span className={styles.legendDot} style={{ background: '#a78bfa' }} />新 進入排名</span>
            </div>
          </div>

          <div className={styles.compTable}>
            {results === null ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🧪</span>
                調整左側參數後點擊「執行」，查看前後排名變化
              </div>
            ) : (
              <>
                <div className={styles.compHeader}>
                  <div className={styles.compColHeader}>原始排名（預設權重）</div>
                  <div className={styles.compColHeader}>調整後排名</div>
                </div>
                <div className={styles.compRows}>
                  {/* Original column */}
                  <div>
                    {(results.original || []).map((r) => (
                      <div key={`orig-${r.id}`} className={`${styles.compItem} ${styles.compLeft}`}>
                        <span className={styles.rankNum}>#{r.rank}</span>
                        <span className={styles.compName}>{r.name}</span>
                        <span className={styles.compScore}>{r.score}</span>
                      </div>
                    ))}
                  </div>
                  {/* Modified column */}
                  <div>
                    {(results.modified || []).map((r) => {
                      const isNew = r.oldRank === undefined || r.oldRank === null;
                      return (
                        <div key={`mod-${r.id}`} className={styles.compItem}>
                          <span className={styles.rankNum}>#{r.rank}</span>
                          <span className={styles.compName}>{r.name}</span>
                          <span className={styles.compScore}>{r.score}</span>
                          <DeltaBadge delta={r.delta} isNew={isNew} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
