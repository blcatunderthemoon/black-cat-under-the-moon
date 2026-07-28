/**
 * Shared Moonlight Gathering #001 survey feedback UI.
 * Used by /dashboard/moonlight-interest and /admin/moonlight-interest.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import KPICard from '../dashboard/KPICard.js';
import ChartCard from '../dashboard/ChartCard.js';
import styles from '../../styles/dashboard/MoonlightInterest.module.css';

const ACCENT = ['#7c5cfc', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#fb7185', '#94a3b8'];
const INTEREST_COLORS = {
  有興趣: '#34d399',
  未能確定: '#fbbf24',
  今次唔參加: '#fb7185',
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipValue}>{payload[0].value} 人</div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-HK', {
      timeZone: 'Asia/Hong_Kong',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * @param {{ apiFetch: (url: string, options?: RequestInit) => Promise<Response> }} props
 */
export default function MoonlightInterestPanel({ apiFetch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | interested | unsure | skip

  const load = useCallback(async () => {
    if (!apiFetch) return;
    setLoading(true);
    setError('');
    try {
      const q = filter === 'all' ? '' : `?interest=${encodeURIComponent(filter)}`;
      const res = await apiFetch(`/api/dashboard/moonlight-interest${q}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `載入失敗（${res.status}）`);
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err.message || '載入失敗');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const charts = data?.charts || {};
  const topDate = data?.top_date;
  const responses = data?.responses || [];

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {[
            { id: 'all', label: '全部' },
            { id: 'interested', label: '有興趣' },
            { id: 'unsure', label: '未能確定' },
            { id: 'skip', label: '唔參加' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`${styles.chip}${filter === opt.id ? ` ${styles.chipActive}` : ''}`}
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? '載入中…' : '重新整理'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.kpiGrid}>
        <KPICard label="總回覆" value={loading ? '…' : totals.all} icon="📋" />
        <KPICard label="有興趣" value={loading ? '…' : totals.interested} icon="✨" sub="已填參加表" />
        <KPICard label="未能確定" value={loading ? '…' : totals.unsure} icon="◐" />
        <KPICard label="今次唔參加" value={loading ? '…' : totals.skip} icon="—" />
      </div>

      {topDate && topDate.value > 0 && (
        <div className={styles.topBanner}>
          <strong>最多人 OK 嘅日子：</strong>
          {topDate.name}
          <span className={styles.topBannerCount}>{topDate.value} 人</span>
          <span className={styles.topBannerHint}>（僅計「有興趣」且有揀該日）</span>
        </div>
      )}

      <div className={styles.sectionHeader}>興趣分佈</div>
      <div className={styles.chartsGrid}>
        <ChartCard title="回覆意向" subtitle="全部回覆" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.interest || []} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={52}>
                {(charts.interest || []).map((entry) => (
                  <Cell key={entry.key} fill={INTEREST_COLORS[entry.name] || '#7c5cfc'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="可接受收費" subtitle="僅「有興趣」" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.prices || []} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={52} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className={styles.sectionHeader}>檔期熱度（有興趣）</div>
      <div className={styles.chartsGridWide}>
        <ChartCard
          title="日期投票（由高至低）"
          subtitle="一人可多選；數字愈高愈多人 OK"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={Math.max(280, (charts.dates_ranked?.length || 0) * 28)}>
            <BarChart
              data={charts.dates_ranked || []}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <XAxis type="number" tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#9490b0', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={88}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(52,211,153,0.07)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {(charts.dates_ranked || []).map((entry, i) => (
                  <Cell key={entry.key} fill={i === 0 ? '#34d399' : ACCENT[i % ACCENT.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className={styles.chartsGrid}>
        <ChartCard title="慣常時段" subtitle="僅「有興趣」" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.time_slots || []} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="日期時間軸" subtitle="按日排列" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.dates || []} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: '#9490b0', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-40}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" fill="#7c5cfc" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className={styles.sectionHeader}>
        回覆列表
        <span className={styles.sectionCount}>{responses.length}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>時間</th>
              <th>意向</th>
              <th>稱呼</th>
              <th>電郵</th>
              <th>Telegram</th>
              <th>日期</th>
              <th>自我介紹</th>
              <th>留言</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className={styles.empty}>載入中…</td>
              </tr>
            )}
            {!loading && responses.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.empty}>暫未有回覆</td>
              </tr>
            )}
            {!loading && responses.map((r) => (
              <tr key={r.id}>
                <td className={styles.muted}>{formatTime(r.created_at)}</td>
                <td>
                  <span className={`${styles.badge} ${styles[`badge_${r.interest}`] || ''}`}>
                    {r.interest_label}
                  </span>
                </td>
                <td>{r.display_name || '—'}</td>
                <td className={styles.email}>{r.email || '—'}</td>
                <td className={styles.email}>{r.telegram_username ? `@${r.telegram_username}` : '—'}</td>
                <td className={styles.wrap}>{r.date_labels.join('、') || '—'}</td>
                <td className={styles.msg}>
                  {r.answers_summary
                    ? r.answers_summary.split('\n').filter(Boolean).map((line) => (
                      <div key={line}>{line}</div>
                    ))
                    : '—'}
                </td>
                <td className={styles.msg}>{r.message || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
