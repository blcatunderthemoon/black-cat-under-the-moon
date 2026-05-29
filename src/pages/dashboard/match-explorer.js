import { useState } from 'react';
import Layout from '../../components/dashboard/Layout';
import MatchDetailPanel from '../../components/dashboard/MatchDetailPanel';
import styles from '../../styles/dashboard/MatchExplorer.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const IDENTITIES = ['', 'TB', 'TBG', 'Pure', 'Bi', 'No Label'];
const SCORE_COLORS = { high: '#4ade80', mid: '#fbbf24', low: '#f87171' };

function scoreColor(s) {
  if (s >= 60) return SCORE_COLORS.high;
  if (s >= 40) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

export default function MatchExplorerPage() {
  const [userId, setUserId] = useState('');
  const [identity, setIdentity] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [minScore, setMinScore] = useState('60');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [anchorUser, setAnchorUser] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const search = async () => {
    if (!userId) return;
    setLoading(true);
    setSelectedMatch(null);
    const params = new URLSearchParams({ userId });
    if (identity)  params.set('identity', identity);
    if (minAge)    params.set('minAge', minAge);
    if (maxAge)    params.set('maxAge', maxAge);
    if (minScore)  params.set('minScore', minScore);

    try {
      const res = await dashFetch(`/api/dashboard/match-explorer?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setAnchorUser(data.user || null);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setUserId(''); setIdentity(''); setMinAge(''); setMaxAge(''); setMinScore('');
    setResults(null); setAnchorUser(null); setSelectedMatch(null);
  };

  return (
    <Layout pageTitle="配對瀏覽器" breadcrumb="儀表板 / 配對瀏覽器">
      <div className={styles.layout}>
        {/* Filter panel */}
        <div className={styles.filterPanel}>
          <div className={styles.filterTitle}>篩選條件</div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>用戶 ID *</label>
            <input
              className={styles.filterInput}
              type="number"
              placeholder="輸入錨點用戶 ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>候選人身份</label>
            <select
              className={styles.filterInput}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            >
              <option value="">全部身份</option>
              {IDENTITIES.filter(Boolean).map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>年齡範圍</label>
            <div className={styles.filterRow}>
              <input
                className={styles.filterInput}
                type="number"
                placeholder="最小"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
              />
              <input
                className={styles.filterInput}
                type="number"
                placeholder="最大"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>最低配對分數（0–100）</label>
            <input
              className={styles.filterInput}
              type="number"
              placeholder="例：40"
              value={minScore}
              min={0}
              max={100}
              onChange={(e) => setMinScore(e.target.value)}
            />
          </div>

          <button className={styles.searchBtn} onClick={search} disabled={!userId || loading}>
            {loading ? '搜索中…' : '查詢配對'}
          </button>
          <button className={styles.clearBtn} onClick={clear}>清除條件</button>
        </div>

        {/* Results panel */}
        <div>
          <div className={styles.resultsPanel}>
            <div className={styles.resultsHeader}>
              <span className={styles.resultsTitle}>
                {anchorUser ? `${anchorUser.name} (${anchorUser.identity}) 的配對結果` : '配對結果'}
              </span>
              {results !== null && (
                <span className={styles.resultCount}>{results.length} 個配對</span>
              )}
            </div>

            <div className={styles.tableWrap}>
              {results === null ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🔍</span>
                  輸入用戶 ID 並點擊「查詢配對」以開始
                </div>
              ) : results.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🌙</span>
                  此條件下暫無配對結果
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>配對對象</th>
                      <th>身份</th>
                      <th>狀態</th>
                      <th>智能分（/100）</th>
                      <th>🔥 火花</th>
                      <th>💞 情感</th>
                      <th>📅 步調</th>
                      <th>💬 溝通</th>
                      <th>💑 期望</th>
                      <th>🛡️ 安全感</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => {
                      const b = r.score_breakdown || {};
                      const isSelected = selectedMatch?.id === r.id;
                      return (
                        <tr
                          key={r.id}
                          className={`${styles.tableRow} ${isSelected ? styles.selected : ''} ${r.already_sent ? styles.sentRow : ''}`}
                          onClick={() => setSelectedMatch(r)}
                        >
                          <td style={{ color: 'var(--text)', fontWeight: 600 }}>{r.name}</td>
                          <td>{r.identity}</td>
                          <td>
                            {r.already_sent && (
                              <span className={styles.sentBadge} title={`已發送 ${r.sent_at ? new Date(r.sent_at).toLocaleDateString('zh-HK') : ''}`}>
                                ✉ 已發送
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={styles.scoreBadge}
                              style={{ color: scoreColor(r.match_score) }}
                            >
                              {r.match_score}
                            </span>
                          </td>
                          <td className={styles.dimScore}>{b.attraction ?? '—'}</td>
                          <td className={styles.dimScore}>{b.emotional ?? '—'}</td>
                          <td className={styles.dimScore}>{b.lifestyle ?? '—'}</td>
                          <td className={styles.dimScore}>{b.communication ?? '—'}</td>
                          <td className={styles.dimScore}>{b.relationship ?? '—'}</td>
                          <td className={styles.dimScore}>{b.conflictSafety ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Match Detail Panel */}
      {selectedMatch && anchorUser && (
        <MatchDetailPanel
          user={anchorUser}
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </Layout>
  );
}
