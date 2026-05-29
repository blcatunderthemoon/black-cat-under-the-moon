import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Layout from '../../components/dashboard/Layout';
import ChartCard from '../../components/dashboard/ChartCard';
import styles from '../../styles/dashboard/QuestionnaireStats.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const ACCENT_COLORS = ['#7c5cfc', '#5b8af0', '#a78bfa', '#818cf8', '#6366f1', '#ec4899', '#34d399', '#f97316'];
const IDENTITY_COLORS = { TB: '#f97316', TBG: '#ec4899', Pure: '#a78bfa', Bi: '#34d399', 'No Label': '#60a5fa' };

// ── Tooltips ──────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(13,11,26,0.95)',
      border: '1px solid rgba(124,92,252,0.3)',
      borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#e8e3f5',
    }}>
      <div style={{ color: '#9490b0', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#a78bfa' }}>{payload[0].value} 人</div>
    </div>
  );
};

const HorizTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(13,11,26,0.95)',
      border: '1px solid rgba(124,92,252,0.3)',
      borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#e8e3f5',
    }}>
      <div style={{ color: '#9490b0', marginBottom: 2, fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#ec4899' }}>{payload[0].value} 人</div>
    </div>
  );
};

// ── Reusable chart renders ────────────────────────────────────
function VertBar({ data, colors, loading, title, subtitle, height = 220 }) {
  return (
    <ChartCard title={title} subtitle={subtitle} loading={loading}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data || []} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fill: '#9490b0', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.07)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={52}>
            {(data || []).map((entry, i) => (
              <Cell key={entry.name} fill={colors ? colors[entry.name] || ACCENT_COLORS[i % ACCENT_COLORS.length] : ACCENT_COLORS[i % ACCENT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function HorizBar({ data, fill, loading, title, subtitle, yWidth = 90, height = 240 }) {
  return (
    <ChartCard title={title} subtitle={subtitle} loading={loading}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data || []} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis type="number" tick={{ fill: '#5e5a78', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: '#9490b0', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={yWidth}
          />
          <Tooltip content={<HorizTooltip />} cursor={{ fill: 'rgba(236,72,153,0.07)' }} />
          <Bar dataKey="value" fill={fill || '#7c5cfc'} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function QuestionnaireStatsPage() {
  const [dist, setDist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashFetch('/api/dashboard/all-distributions')
      .then((r) => r.json())
      .then((d) => { setDist(d); setLoading(false); });
  }, []);

  const d = dist || {};

  return (
    <Layout pageTitle="問卷統計" breadcrumb="儀表板 / 問卷統計">

      {/* ── Part 1: Visuals ── */}
      <div className={styles.sectionHeader}>Part 1 · 基本畫像 The Visuals</div>
      <div className={styles.chartsGrid}>
        <VertBar
          title="身份分佈" subtitle="各身份類型用戶數量"
          data={d.identity} colors={IDENTITY_COLORS} loading={loading}
        />
        <VertBar
          title="髮型分佈" subtitle="用戶髮型標籤分佈"
          data={d.hair_style} loading={loading}
        />
        <VertBar
          title="體型分佈" subtitle="各體型類別用戶數量"
          data={d.body_type} loading={loading}
        />
        <VertBar
          title="床上地位" subtitle="Top / Bottom / Switch 分佈"
          data={d.bed_role} loading={loading}
        />
      </div>
      <HorizBar
        title="穿搭風格（多選）" subtitle="各風格被選次數"
        data={d.fashion_styles} fill="#a78bfa" yWidth={80} height={280} loading={loading}
      />

      {/* ── Part 2: Daily Energy ── */}
      <div className={styles.sectionHeader}>Part 2 · 生活動能 Daily Energy</div>
      <div className={styles.chartsGrid}>
        <VertBar
          title="社交電量" subtitle="戶外玩家 vs 宅家 vs 中間"
          data={d.social_energy} loading={loading}
        />
        <VertBar
          title="理想週末模式" subtitle="社交 / 二人 / 平衡 / 隨心"
          data={d.weekend_mode} loading={loading}
        />
        <VertBar
          title="旅行模式" subtitle="隨心即興 vs 完美攻略"
          data={d.travel_mode} loading={loading}
        />
      </div>
      <HorizBar
        title="興趣活動（多選）" subtitle="各興趣被選次數排行"
        data={d.interests} fill="#5b8af0" yWidth={130} height={320} loading={loading}
      />
      <HorizBar
        title="運動習慣（多選）" subtitle="各運動被選次數"
        data={d.exercise_habits} fill="#34d399" yWidth={110} height={240} loading={loading}
      />

      {/* ── Part 3: Relationships ── */}
      <div className={styles.sectionHeader}>Part 3 · 關係導向 Relationships</div>
      <div className={styles.chartsGrid}>
        <VertBar
          title="關係期待" subtitle="長期 / 順其自然 / Casual / 開放"
          data={d.relationship_goal} loading={loading}
        />
        <VertBar
          title="時間投入" subtitle="每週可投入相處頻率"
          data={d.time_commitment} loading={loading}
        />
        <HorizBar
          title="最大地雷（多選）" subtitle="各 deal-breaker 被選次數"
          data={d.deal_breakers} fill="#f97316" yWidth={70} height={200} loading={loading}
        />
      </div>

      {/* ── Part 4: Soul ── */}
      <div className={styles.sectionHeader}>Part 4 · 靈魂共鳴 The Deep Layer</div>
      <div className={styles.chartsGrid}>
        <HorizBar
          title="愛的語言（多選）" subtitle="各愛的語言被選次數"
          data={d.love_languages} fill="#ec4899" yWidth={70} height={200} loading={loading}
        />
        <VertBar
          title="安全感需求" subtitle="關係中最需要嘅安全感類型"
          data={d.security_needs} loading={loading}
        />
        <VertBar
          title="愛的日常小事" subtitle="最能代表愛嘅日常行為"
          data={d.daily_love_ritual} loading={loading}
        />
      </div>

      {/* ── Part 5: Values ── */}
      <div className={styles.sectionHeader}>Part 5 · 內在邏輯 Values &amp; Logic</div>
      <div className={styles.chartsGrid}>
        <VertBar
          title="決策導向" subtitle="直覺系 vs 事實系"
          data={d.decision_making} loading={loading}
        />
        <VertBar
          title="溝通體質" subtitle="分歧時嘅溝通風格"
          data={d.communication_style} loading={loading}
        />
        <VertBar
          title="分費方式" subtitle="約會開支偏好"
          data={d.expense_splitting} loading={loading}
        />
        <VertBar
          title="同居觀" subtitle="對同居生活嘅態度"
          data={d.living_together} loading={loading}
        />
      </div>

    </Layout>
  );
}
