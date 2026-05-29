import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Layout from '../../components/dashboard/Layout';
import ChartCard from '../../components/dashboard/ChartCard';
import styles from '../../styles/dashboard/MatchingAnalytics.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const DIMENSIONS = [
  { key: 'attraction',     label: '🔥 身體吸引力', color: '#f97316' },
  { key: 'emotional',      label: '💞 情感共鳴',   color: '#ec4899' },
  { key: 'lifestyle',      label: '📅 生活步調',   color: '#34d399' },
  { key: 'communication',  label: '💬 溝通與三觀', color: '#a78bfa' },
  { key: 'relationship',   label: '💑 關係期待',   color: '#5b8af0' },
  { key: 'conflictSafety', label: '🛡 相處安全感', color: '#fb923c' },
];

const IDENTITIES = ['TB', 'TBG', 'Pure', 'Bi', 'No Label'];

function scoreColor(val) {
  // 0-100 → red to green via purple
  if (!val) return 'rgba(255,255,255,0.04)';
  const t = val / 100;
  const r = Math.round(124 + (52 - 124) * t);
  const g = Math.round(92  + (211 - 92) * t);
  const b = Math.round(252 + (99 - 252) * t);
  return `rgba(${r},${g},${b},${0.2 + t * 0.65})`;
}

function ScoreHistogram({ data, loading, anchorId, isUserSpecific }) {
  const subtitle = isUserSpecific
    ? `用戶 #${anchorId} 的配對分數分佈（通過 Hard Filter，v4 引擎，0–100 分制）`
    : '全局配對分數分佈（所有配對對，通過 Hard Filter，v4 引擎，0–100 分制）';
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'rgba(13,11,26,0.95)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#e8e3f5' }}>
        <div style={{ color: '#9490b0', marginBottom: 2 }}>{label} 分</div>
        <div style={{ fontWeight: 700, color: '#a78bfa' }}>{payload[0].value} 對</div>
      </div>
    );
  };
  return (
    <ChartCard title="配對分數分佈" subtitle={subtitle} loading={loading}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {(data || []).map((_, i) => (
              <Cell key={i} fill={`hsl(${250 + i * 8}, 70%, ${50 + i * 3}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function DimensionAvgCard({ avgs, loading, anchorId, isUserSpecific }) {
  const subtitle = isUserSpecific
    ? `用戶 #${anchorId} 的配對，各維度平均分（0–20）`
    : '全局配對對各維度分均値（0–20）';
  const max = 20;
  return (
    <ChartCard title="各維度平均分" subtitle={subtitle} loading={loading}>
      <div className={styles.dimBars}>
        {DIMENSIONS.map((d) => {
          const val = avgs?.[d.key] ?? 0;
          const pct = (val / max) * 100;
          return (
            <div key={d.key} className={styles.dimRow}>
              <div className={styles.dimLabel}>
                <span>{d.label}</span>
                <span className={styles.dimValue}>{val.toFixed(1)} / 20</span>
              </div>
              <div className={styles.dimTrack}>
                <div
                  className={styles.dimFill}
                  style={{ width: `${pct}%`, background: d.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

function FunnelCard({ data, loading }) {
  const total = data?.[0]?.count || 1;
  return (
    <ChartCard title="篩選漏斗" subtitle="各階段 Hard Filter 剩餘人數" loading={loading}>
      <div className={styles.funnel}>
        {(data || []).map((row) => {
          const pct = Math.round((row.count / total) * 100);
          return (
            <div key={row.stage} className={styles.funnelRow}>
              <div className={styles.funnelLabel}>
                <span>{row.stage}</span>
                <span className={styles.funnelCount}>{row.count} 人</span>
              </div>
              <div className={styles.funnelTrack}>
                <div className={styles.funnelBar} style={{ width: `${pct}%` }}>
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

function HeatmapCard({ data, loading }) {
  // Build 5×5 matrix
  const matrix = {};
  for (const row of IDENTITIES) {
    matrix[row] = {};
    for (const col of IDENTITIES) matrix[row][col] = null;
  }
  for (const { x, y, value } of (data || [])) {
    if (matrix[x]) matrix[x][y] = value;
    if (matrix[y]) matrix[y][x] = value;
  }

  return (
    <ChartCard title="身份配對熱力圖" subtitle="各身份組合平均配對分數（v4 引擎，0–100）" loading={loading}>
      <div className={styles.heatmapWrap}>
        <div className={styles.heatmapGrid} style={{ gridTemplateColumns: `52px repeat(${IDENTITIES.length}, 52px)` }}>
          {/* Header row */}
          <div className={styles.heatLabel} />
          {IDENTITIES.map((id) => (
            <div key={id} className={styles.heatLabel}>{id}</div>
          ))}
          {/* Data rows */}
          {IDENTITIES.map((rowId) => (
            <>
              <div key={`row-${rowId}`} className={styles.heatLabel}>{rowId}</div>
              {IDENTITIES.map((colId) => {
                const val = matrix[rowId][colId];
                return (
                  <div
                    key={colId}
                    className={styles.heatCell}
                    style={{ background: scoreColor(val) }}
                    title={val !== null ? `${rowId} × ${colId}: ${val} 分` : '無資料'}
                  >
                    {val !== null ? val : '—'}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export default function MatchingAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Load user list for selector
  useEffect(() => {
    dashFetch('/api/dashboard/distributions')
      .then((r) => r.json())
      .catch(() => ({}));
    // Fetch a light user list via stats endpoint users list — use match-explorer with a fallback
    dashFetch('/api/dashboard/matching-analytics')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const fetchForUser = (uid) => {
    setLoading(true);
    const url = uid ? `/api/dashboard/matching-analytics?userId=${uid}` : '/api/dashboard/matching-analytics';
    dashFetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  return (
    <Layout pageTitle="配對分析" breadcrumb="儀表板 / 配對分析">
      {/* User selector for funnel */}
      <div className={styles.userSelect}>
        <label>漏斗錨點用戶 ID：</label>
        <input
          className={styles.select}
          type="number"
          placeholder="輸入用戶 ID（空白 = 第一位用戶）"
          value={selectedUserId}
          style={{ width: 240 }}
          onChange={(e) => setSelectedUserId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fetchForUser(selectedUserId);
          }}
        />
        <button
          onClick={() => fetchForUser(selectedUserId)}
          style={{
            background: 'linear-gradient(135deg, #7c5cfc, #5b8af0)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          套用
        </button>
        {data?.anchor_user_id && (
          <span style={{ fontSize: 12, color: '#9490b0' }}>
            目前錨點：用戶 #{data.anchor_user_id}
          </span>
        )}
      </div>

      <div className={styles.topRow}>
        <ScoreHistogram data={data?.score_distribution || []} loading={loading} anchorId={data?.anchor_user_id} isUserSpecific={data?.is_user_specific} />
        <DimensionAvgCard avgs={data?.dimension_averages} loading={loading} anchorId={data?.anchor_user_id} isUserSpecific={data?.is_user_specific} />
      </div>

      <div className={styles.bottomRow}>
        <FunnelCard data={data?.funnel || []} loading={loading} />
        <HeatmapCard data={data?.identity_heatmap || []} loading={loading} />
      </div>
    </Layout>
  );
}
