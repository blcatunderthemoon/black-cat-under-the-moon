import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Layout from '../../components/dashboard/Layout';
import KPICard from '../../components/dashboard/KPICard';
import ChartCard from '../../components/dashboard/ChartCard';
import styles from '../../styles/dashboard/Overview.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const ACCENT_COLORS = ['#7c5cfc', '#5b8af0', '#a78bfa', '#818cf8', '#6366f1'];
const IDENTITY_COLORS = { TB: '#f97316', TBG: '#ec4899', Pure: '#a78bfa', Bi: '#34d399', 'No Label': '#60a5fa' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(13,11,26,0.95)',
      border: '1px solid rgba(124,92,252,0.3)',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 13,
      color: '#e8e3f5',
    }}>
      <div style={{ color: '#9490b0', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#a78bfa' }}>{payload[0].value} 人</div>
    </div>
  );
};


export default function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [dist, setDist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashFetch('/api/dashboard/stats?threshold=60').then((r) => r.json()),
      dashFetch('/api/dashboard/distributions').then((r) => r.json()),
    ]).then(([s, d]) => {
      setStats(s);
      setDist(d);
      setLoading(false);
    });
  }, []);

  const headerStats = stats
    ? [
        { label: '總用戶', value: stats.total_users },
        { label: '活躍 7 日', value: stats.active_users },
        { label: '配對率', value: `${stats.match_rate}%` },
      ]
    : [];

  return (
    <Layout pageTitle="總覽" breadcrumb="儀表板 / 總覽" headerStats={headerStats}>
      {/* KPI Row */}
      <div className={styles.kpiGrid}>
        <KPICard
          label="總用戶數"
          value={loading ? '...' : stats?.total_users}
          unit="人"
          icon="👥"
        />
        <KPICard
          label="活躍用戶（7 日）"
          value={loading ? '...' : stats?.active_users}
          unit="人"
          icon="⚡"
        />
        <KPICard
          label="配對成功率"
          value={loading ? '...' : stats?.match_rate}
          unit="%"
          icon="💫"
          sub={loading ? '計算中...' : `${stats?.users_with_match ?? 0} 人有配對（智能分 ≥ 60）`}
        />
        <KPICard
          label="平均配對分數"
          value={loading ? '...' : stats?.avg_match_score}
          unit="/ 100"
          icon="✦"
        />
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        {/* Identity distribution */}
        <ChartCard
          title="身份分佈"
          subtitle="各身份類型用戶數量"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dist?.identity || []} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {(dist?.identity || []).map((entry, i) => (
                  <Cell key={entry.name} fill={IDENTITY_COLORS[entry.name] || ACCENT_COLORS[i % ACCENT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Age distribution */}
        <ChartCard
          title="年齡分佈"
          subtitle="用戶年齡區間直方圖"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dist?.age || []} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" fill="#5b8af0" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Height distribution */}
        <ChartCard
          title="身高分佈"
          subtitle="用戶身高區間（cm）"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dist?.height || []} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" fill="#00e5ff" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Hair style distribution */}
        <ChartCard
          title="髮型分佈"
          subtitle="用戶髮型標籤分佈"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dist?.hair_style || []} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
              <Bar dataKey="value" fill="#f472b6" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {(dist?.hair_style || []).map((entry, i) => (
                  <Cell key={entry.name} fill={ACCENT_COLORS[i % ACCENT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </Layout>
  );
}
