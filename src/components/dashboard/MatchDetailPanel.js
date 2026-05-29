import { useState } from 'react';
import {
  RadarChart as ReRadar, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import styles from '../../styles/dashboard/MatchDetailPanel.module.css';

const DIM_LABELS = [
  { key: 'attraction',    label: '🔥 火花',     color: '#f97316', max: 20 },
  { key: 'emotional',     label: '💞 情感共鳴', color: '#ec4899', max: 20 },
  { key: 'lifestyle',     label: '📅 生活步調', color: '#34d399', max: 20 },
  { key: 'communication', label: '💬 溝通價值', color: '#a78bfa', max: 20 },
  { key: 'relationship',    label: '💑 關係期望',   color: '#38bdf8', max: 20 },
  { key: 'conflictSafety', label: '🛡 相處安全感', color: '#fb923c', max: 20 },
];

function syncLabel(score) {
  if (score >= 75) return '超高同步 ✨';
  if (score >= 60) return '高同步 💫';
  if (score >= 45) return '可發展 🌱';
  return '待觀察 🔭';
}

function compatText(user, match) {
  const intel = match.intelligence;
  if (intel?.summary?.text) return intel.summary.text;
  const b = match.score_breakdown || {};
  const parts = [];
  if ((b.attraction ?? 0) >= 15) parts.push('吸引力強烈');
  if ((b.emotional ?? 0) >= 15)  parts.push('情感共鳴高');
  if ((b.lifestyle ?? 0) >= 15)  parts.push('生活步調一致');
  if ((b.communication ?? 0) >= 15) parts.push('溝通價值觀吐合');
  if (parts.length === 0) return '雙方在多個維度仍有磨合空間，但基礎相容性通過篩選。';
  return `雙方的 <strong>${parts.join('、')}</strong>，整體配對潛力${match.match_score >= 65 ? '極高' : '良好'}。`;
}

export default function MatchDetailPanel({ user, match, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  if (!user || !match) return null;

  const b = match.score_breakdown || {};
  const intel = match.intelligence;

  async function captureHtmlAsPng(html, filename) {
    // Load html2canvas from CDN to avoid Turbopack build-time resolution
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load html2canvas'));
        document.head.appendChild(s);
      });
    }
    const html2canvas = window.html2canvas;
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:840px;height:1200px;border:none;';
      document.body.appendChild(iframe);
      const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };

      iframe.addEventListener('load', async () => {
        try {
          if (iframe.contentDocument?.fonts) await iframe.contentDocument.fonts.ready;
          await new Promise(r => setTimeout(r, 700));
          const canvas = await html2canvas(iframe.contentDocument.documentElement, {
            useCORS: true,
            scale: 2,
            width: 840,
            windowWidth: 840,
            backgroundColor: '#07060e',
            logging: false,
          });
          cleanup();
          canvas.toBlob(blob => {
            if (!blob) { reject(new Error('PNG blob failed')); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            resolve();
          }, 'image/png');
        } catch (err) { cleanup(); reject(err); }
      });

      iframe.srcdoc = html;
    });
  }

  async function handleGenerateCard() {
    setGenerating(true);
    setGenError(null);
    try {
      // Use pre-computed intelligence from match-explorer if available
      const intelligence = intel
        ? { dimensionScores: intel.dimensionScores, summary: intel.summary }
        : await (async () => {
            const r = await fetch('/api/dashboard/intelligence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userA: user, userB: match }),
            });
            const d = r.ok ? await r.json() : null;
            return d?.dimensionScores ? { dimensionScores: d.dimensionScores, summary: d.summary } : null;
          })();

      const displayScore = intel?.finalScore ?? match.match_score;

      const makePayload = (userId, targetId) => JSON.stringify({
        userId,
        targetId,
        match_score: displayScore,
        score_breakdown: match.score_breakdown || {},
        intelligence,
      });

      const [resA, resB] = await Promise.all([
        fetch('/api/match_card/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: makePayload(user.id, match.id),
        }),
        fetch('/api/match_card/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: makePayload(match.id, user.id),
        }),
      ]);

      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);

      if (!resA.ok || !dataA.success) { setGenError(dataA.error || '生成失敗'); return; }
      if (!resB.ok || !dataB.success) { setGenError(dataB.error || '生成失敗'); return; }

      const slug = (n) => String(n || '').replace(/\s+/g, '_');
      await captureHtmlAsPng(dataA.html, `match_${slug(user.name)}_x_${slug(match.name)}.png`);
      await captureHtmlAsPng(dataB.html, `match_${slug(match.name)}_x_${slug(user.name)}.png`);
    } catch (err) {
      setGenError('網絡錯誤，請重試');
    } finally {
      setGenerating(false);
    }
  }

  const radarData = DIM_LABELS.map((d) => ({
    subject: d.label,
    value: Math.round(((b[d.key] ?? 0) / d.max) * 100),
    fullMark: 100,
  }));

  return (
    <>
      <div className={styles.overlay_placeholder} onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
      }} />
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>配對詳情</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.panelBody}>
          {/* Score banner */}
          <div className={styles.scoreBanner}>
            <div className={styles.totalScore}>
              <span className={styles.scoreNum}>{match.match_score}</span>
              <span className={styles.scoreLabel}>智能配對分 / 100</span>
            </div>
            <span className={styles.syncLabel}>{syncLabel(match.match_score)}</span>
          </div>

          {/* User profiles */}
          <div className={styles.profiles}>
            <div className={styles.profileCard}>
              <div className={styles.profileRole}>用戶 A（你）</div>
              <div className={styles.profileName}>{user.name}</div>
              <div className={styles.profileKV}><span>身份</span><span>{user.identity || '—'}</span></div>
              <div className={styles.profileKV}><span>年齡</span><span>{user.age || '—'}</span></div>
              <div className={styles.profileKV}><span>床上地位</span><span>{user.bed_role || '—'}</span></div>
            </div>
            <div className={styles.profileCard}>
              <div className={styles.profileRole}>配對對象</div>
              <div className={styles.profileName}>{match.name}</div>
              <div className={styles.profileKV}><span>身份</span><span>{match.identity || '—'}</span></div>
              <div className={styles.profileKV}><span>年齡</span><span>{match.age || '—'}</span></div>
              <div className={styles.profileKV}><span>床上地位</span><span>{match.bed_role || '—'}</span></div>
            </div>
          </div>

          {/* Radar chart */}
          <div className={styles.radarWrap}>
            <div className={styles.sectionTitle}>六維度雷達圖</div>
            <ResponsiveContainer width="100%" height={220}>
              <ReRadar data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#9490b0', fontSize: 11 }}
                />
                <Radar
                  dataKey="value"
                  stroke="#7c5cfc"
                  fill="rgba(124,92,252,0.35)"
                  fillOpacity={1}
                  strokeWidth={2}
                />
              </ReRadar>
            </ResponsiveContainer>
          </div>

          {/* Score breakdown bars */}
          <div className={styles.scoreBars}>
            <div className={styles.sectionTitle}>分數明細</div>
            {DIM_LABELS.map((d) => {
              const val = b[d.key] ?? 0;
              const pct = (val / d.max) * 100;
              return (
                <div key={d.key} className={styles.barRow}>
                  <div className={styles.barLabel}>
                    <span>{d.label}</span>
                    <span style={{ color: d.color, fontWeight: 700 }}>{val} / {d.max}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${pct}%`, background: d.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compatibility summary */}
          <div className={styles.compatSummary}>
            <p
              className={styles.compatText}
              dangerouslySetInnerHTML={{ __html: compatText(user, match) }}
            />
          </div>

          {/* Generate card */}
          <div className={styles.generateSection}>
            <button
              className={styles.generateBtn}
              onClick={handleGenerateCard}
              disabled={generating}
            >
              {generating ? '生成中…' : '🃏 下載配對卡片 (×2 PNG)'}
            </button>
            {genError && <div className={styles.genError}>{genError}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
