import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Layout from '../../components/dashboard/Layout';
import ChartCard from '../../components/dashboard/ChartCard';
import styles from '../../styles/dashboard/Scoring.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

// ─── Static mechanism data ────────────────────────────────────────────────────

const DIMENSIONS = [
  {
    emoji: '🔥',
    name: '身體吸引力',
    key: 'attraction',
    weight: '15%',
    color: '#f97316',
    factors: [
      'Top ↔ Bottom 完全互補 → 18 分',
      'Switch ↔ 非 Switch → 16 分',
      'Switch ↔ Switch → 15 分',
      '躺平派 / 中性（任一方）→ 12 分',
      '同類（Top+Top / Bottom+Bottom）→ 10 分 ↑v4',
      '日常愛的儀式相同 → 額外 +2',
    ],
  },
  {
    emoji: '💞',
    name: '情感共鳴',
    key: 'emotional',
    weight: '20%',
    color: '#ec4899',
    factors: [
      '愛的語言重疊：每個 +5，上限 10 分',
      '零重疊時基礎 +2（共同認同框架）↑v4',
      '安全感需求相同 +6，衝突 +1，其他 +3',
      '日常愛的儀式相同 +4，不同 +1',
    ],
  },
  {
    emoji: '📅',
    name: '生活步調',
    key: 'lifestyle',
    weight: '15%',
    color: '#34d399',
    factors: [
      '社交能量相同 +5，動靜皆宜 +3，其他 +1',
      '週末模式相同 +5，平衡/隨心 +3，其他 +1',
      '興趣活動重疊：每個 +2，上限 10 分 ↑v4',
      '運動習慣重疊：每個 +2，上限 4 分 ↑v4',
      '旅行模式相同 +4，不同 +1',
    ],
  },
  {
    emoji: '💬',
    name: '溝通與三觀',
    key: 'communication',
    weight: '15%',
    color: '#a78bfa',
    factors: [
      '溝通風格相同 +8，直球↔觀察留白衝突 +1，其他 +4',
      '費用分擔相同 +6，AA↔你一餐軟相容 +3，其他 +1',
      '同住時間線相同 +6，硬衝突 0，其他 +3',
      '決策方式互補（直覺+事實）+5，相同/其他 +2 ↑v4',
    ],
  },
  {
    emoji: '💑',
    name: '關係期待',
    key: 'relationship',
    weight: '20%',
    color: '#5b8af0',
    factors: [
      '關係目標相容度：完全一致 14 分，近似 8 分，兼容 2 分，衝突 0 分',
      '相見頻率差 0 → +6，差 1 → +4，差 2 → +2，差 3+ → 0',
    ],
  },
  {
    emoji: '🛡',
    name: '相處安全感',
    key: 'conflictSafety',
    weight: '15%',
    color: '#fb923c',
    factors: [
      '雙方均冷暴力傾向 → 2 分（極危）',
      '雷區直接衝突 2 個 → 4 分，1 個 → 10 分',
      '共同雷點 ≥2 → 20 分（高度對齊）',
      '共同雷點 1 → 16 分，無衝突 → 14 分',
    ],
  },
];

const ADJUSTMENTS = [
  {
    condition: '情感 ≥ 14 且 溝通 ≥ 14',
    op: '+7',
    opClass: 'bonus',
    note: '雙高加成，上限 100，反映關係韌性 ↑v4（原 ≥16, +5）',
  },
  {
    condition: '關係維度 ≤ 4',
    op: '× 0.75',
    opClass: 'mult',
    note: '目標嚴重不合，任何高相容都無法彌補',
  },
  {
    condition: '安全感 ≤ 5',
    op: '− 7',
    opClass: 'minus',
    note: '雙方存在明顯冷暴力衝突（極低安全感警告）',
  },
  {
    condition: '外在偏好落差（身份/體型/身高/年齡差）',
    op: '− 最多 8',
    opClass: 'cap',
    note: 'Soft penalty，每項 +3–6，上限 8 分 ↑v4（原上限 12）',
  },
];

// ─── Identity heatmap helpers ─────────────────────────────────────────────────

const IDENTITIES = ['TB', 'TBG', 'Pure', 'Bi', 'No Label'];

function scoreColor(val) {
  if (val === null || val === undefined) return 'rgba(255,255,255,0.04)';
  const t = val / 100;
  const r = Math.round(100 + (52 - 100) * t);
  const g = Math.round(80  + (211 - 80) * t);
  const b = Math.round(255 + (99 - 255) * t);
  return `rgba(${r},${g},${b},${0.15 + t * 0.7})`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DimCard({ dim }) {
  return (
    <div className={styles.dimCard} style={{ '--dim-color': dim.color }}>
      <div className={styles.dimCardHeader}>
        <span className={styles.dimEmoji}>{dim.emoji}</span>
        <span className={styles.dimName}>{dim.name}</span>
        <div className={styles.dimBadge}>
          <span className={styles.dimWeight}>{dim.weight}</span>
          <span className={styles.dimMax}>滿分 20</span>
        </div>
      </div>
      <ul className={styles.dimFactors}>
        {dim.factors.map((f, i) => (
          <li key={i} className={styles.dimFactor}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

function ScoreHistogram({ data, loading }) {
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
    <ChartCard title="配對分數分佈" subtitle="通過 Hard Filter 配對對數（v4 引擎，0–100 分制）" loading={loading}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {(data || []).map((_, i) => (
              <Cell key={i} fill={`hsl(${240 + i * 14}, 70%, ${45 + i * 3}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function DimAvgCard({ avgs, loading }) {
  return (
    <ChartCard title="各維度平均分" subtitle="通過 Hard Filter 的所有配對對均值（0–20）" loading={loading}>
      <div className={styles.dimBars}>
        {DIMENSIONS.map((d) => {
          const val = avgs?.[d.key] ?? 0;
          const pct = (val / 20) * 100;
          return (
            <div key={d.key} className={styles.dimRow}>
              <div className={styles.dimRowLabel}>
                <span>{d.emoji} {d.name}</span>
                <span className={styles.dimRowValue}>{val.toFixed(1)} / 20</span>
              </div>
              <div className={styles.dimTrack}>
                <div className={styles.dimFill} style={{ width: `${pct}%`, background: d.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

function HeatmapCard({ data, loading }) {
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
          <div className={styles.heatLabel} />
          {IDENTITIES.map((id) => (
            <div key={id} className={styles.heatLabel}>{id}</div>
          ))}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScoringPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashFetch('/api/dashboard/scoring-overview')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const stats = data?.stats;

  return (
    <Layout pageTitle="計分說明" breadcrumb="儀表板 / 計分說明">
      {/* ── Section A: Mechanism ─────────────────────── */}
      <p className={styles.sectionLabel}>計分機制 — v4 六維度智能引擎（0–100 分制）</p>

      <div className={styles.mechanismGrid}>
        {DIMENSIONS.map((d) => <DimCard key={d.key} dim={d} />)}
      </div>

      <div className={styles.adjustSection}>
        <div className={styles.adjustTitle}>非線性調整（依序套用）</div>
        <table className={styles.adjustTable}>
          <thead>
            <tr>
              <th>觸發條件</th>
              <th>調整</th>
              <th>說明</th>
            </tr>
          </thead>
          <tbody>
            {ADJUSTMENTS.map((row, i) => (
              <tr key={i}>
                <td>{row.condition}</td>
                <td>
                  <span className={`${styles.adjustOp} ${styles[row.opClass]}`}>
                    {row.op}
                  </span>
                </td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section B: Live stats ────────────────────── */}
      <p className={styles.sectionLabel}>即時配對分析（根據現有用戶數據）</p>

      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statPill}>
            配對對數 <strong>{stats.total_pairs}</strong>
          </div>
          <div className={styles.statPill}>
            平均分 <strong>{stats.mean}</strong>
          </div>
          <div className={styles.statPill}>
            中位數 <strong>{stats.median}</strong>
          </div>
          <div className={styles.statPill}>
            75 百分位 <strong>{stats.p75}</strong>
          </div>
          {stats.total_pairs > 0 && (
            <div className={styles.statPill}>
              ≥75 分 <strong>
                {Math.round(
                  ((data?.score_distribution || [])
                    .filter((b) => parseInt(b.name) >= 70)
                    .reduce((s, b) => s + b.value, 0) /
                    stats.total_pairs) * 100
                )}%
              </strong>
            </div>
          )}
        </div>
      )}

      <div className={styles.chartRow}>
        <ScoreHistogram data={data?.score_distribution || []} loading={loading} />
        <DimAvgCard avgs={data?.dimension_averages} loading={loading} />
      </div>

      <HeatmapCard data={data?.identity_heatmap || []} loading={loading} />
    </Layout>
  );
}
