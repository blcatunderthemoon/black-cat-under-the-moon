/**
 * Match card HTML builder (shared by /api/matches/card and /api/match_card/template).
 */
import { getSiteUrl, getSiteHostFromUrl } from './site-seo.js';
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toRadarPercent(value, max = 20) {
  const n = Number(value);
  if (Number.isNaN(n) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((n / max) * 100)));
}

function getRarity(s) {
  if (s >= 91) return { label: 'SSR', tier: 'ssr' };
  if (s >= 81) return { label: 'SR',  tier: 'sr'  };
  if (s >= 75) return { label: 'R',   tier: 'r'   };
  return null;
}

function buildPixelCat(identity, width, height) {
  const w = width || 52;
  const h = height || 52;
  const acc = {
    'TB':       '<rect x="10" y="0" width="12" height="6" fill="#223388"/><rect x="8" y="5" width="16" height="2" fill="#1a2a77"/><rect x="11" y="1" width="6" height="2" fill="#4466bb"/>',
    'TBG':      '<rect x="6" y="1" width="7" height="5" fill="#ff4499"/><rect x="7" y="0" width="5" height="2" fill="#ff88cc"/><rect x="19" y="1" width="7" height="5" fill="#ff4499"/><rect x="20" y="0" width="5" height="2" fill="#ff88cc"/><rect x="13" y="1" width="6" height="5" fill="#cc0055"/>',
    'Pure':     '<rect x="8" y="5" width="16" height="2" fill="#1a7030"/><rect x="7" y="2" width="5" height="4" fill="#ff79c6"/><rect x="8" y="3" width="3" height="2" fill="#ffff88"/><rect x="13" y="0" width="6" height="6" fill="#ffaadd"/><rect x="14" y="2" width="4" height="2" fill="#ffe066"/><rect x="20" y="2" width="5" height="4" fill="#ff79c6"/><rect x="21" y="3" width="3" height="2" fill="#ffff88"/>',
    'Bi':       '<rect x="8" y="4" width="16" height="3" fill="#7722aa"/><rect x="8" y="1" width="5" height="4" fill="#ff6b9d"/><rect x="13" y="0" width="6" height="5" fill="#bb66ff"/><rect x="19" y="1" width="5" height="4" fill="#5b5fdd"/>',
    'No Label': '<rect x="13" y="0" width="6" height="2" fill="#ff6b9d"/><rect x="11" y="2" width="10" height="2" fill="#ffe066"/><rect x="9" y="4" width="14" height="2" fill="#00e5ff"/>',
  }[identity] || '';
  return `<svg viewBox="0 0 32 32" width="${w}" height="${h}" shape-rendering="crispEdges" style="image-rendering:pixelated;flex-shrink:0"><rect x="6" y="4" width="4" height="4" fill="#3a3660"/><rect x="8" y="2" width="2" height="2" fill="#3a3660"/><rect x="22" y="4" width="4" height="4" fill="#3a3660"/><rect x="22" y="2" width="2" height="2" fill="#3a3660"/><rect x="6" y="8" width="20" height="12" fill="#3a3660"/><rect x="8" y="6" width="16" height="2" fill="#3a3660"/><rect x="10" y="11" width="2" height="3" fill="#50fa7b"/><rect x="20" y="11" width="2" height="3" fill="#50fa7b"/><rect x="15" y="15" width="2" height="2" fill="#ff79c6"/><rect x="8" y="20" width="16" height="6" fill="#3a3660"/><rect x="10" y="26" width="4" height="2" fill="#3a3660"/><rect x="18" y="26" width="4" height="2" fill="#3a3660"/><rect x="26" y="3" width="2" height="2" fill="#ffe066"/><rect x="28" y="5" width="2" height="4" fill="#ffe066"/><rect x="26" y="9" width="2" height="2" fill="#ffe066"/>${acc}</svg>`;
}

function buildMatchCardHtml({ user, target, score, breakdown, intelligence, siteUrl: siteUrlOverride }) {
  const siteBase = String(siteUrlOverride || getSiteUrl()).replace(/\/$/, '');
  const siteUrl = `${siteBase}/`;
  const siteHost = getSiteHostFromUrl(siteBase);
  const dims = intelligence?.dimensionScores || {};

  // ── Radar values (normalised to 0-100) — always 6-dimension hexagon ─────
  const numAxes = 6;
  const radarValues = [
    toRadarPercent(dims.attraction ?? 0),
    toRadarPercent(dims.emotional ?? 0),
    toRadarPercent(dims.lifestyle ?? 0),
    toRadarPercent(dims.communication ?? 0),
    toRadarPercent(dims.relationship ?? 0),
    toRadarPercent(dims.conflictSafety ?? 0),
  ];
  const radarLabels = ['火花', '情感共鳴', '生活步調', '溝通價值', '關係期望', '相處安全感'];

  const avg = radarValues.reduce((s, v) => s + v, 0) / numAxes;
  const radius = 145;
  const cx = 260, cy = 230;

  const point = (idx, percent) => {
    const angle = (-90 + idx * (360 / numAxes)) * (Math.PI / 180);
    const len = radius * (percent / 100);
    return `${(cx + Math.cos(angle) * len).toFixed(1)},${(cy + Math.sin(angle) * len).toFixed(1)}`;
  };

  const gridPoly = (pct) => Array.from({length: numAxes}, (_, i) => {
    const angle = (-90 + i * (360 / numAxes)) * (Math.PI / 180);
    const len = radius * pct;
    return `${(cx + Math.cos(angle) * len).toFixed(1)},${(cy + Math.sin(angle) * len).toFixed(1)}`;
  }).join(' ');

  const polygon = radarValues.map((v, i) => point(i, v)).join(' ');

  // Label positions — offset outward from each vertex (label + % stacked)
  const labelPos = radarLabels.map((label, i) => {
    const angleDeg = -90 + i * (360 / numAxes);
    const angleRad = angleDeg * (Math.PI / 180);
    const offset = 38;
    const lx = cx + Math.cos(angleRad) * (radius + offset);
    const ly = cy + Math.sin(angleRad) * (radius + offset);
    const anchor = Math.cos(angleRad) > 0.1 ? 'start' : Math.cos(angleRad) < -0.1 ? 'end' : 'middle';
    const yAdj = Math.sin(angleRad) > 0.1 ? 10 : 0;
    // Estimate visual center-x of the label for centering the % below it
    // CJK chars at font-size 16 ≈ 16px each
    const halfW = (label.length * 16) / 2;
    const pcx = anchor === 'start' ? lx + halfW : anchor === 'end' ? lx - halfW : lx;
    return { x: lx.toFixed(1), y: (ly + yAdj).toFixed(1), anchor, pcx: pcx.toFixed(1) };
  });

  const avgLabel = avg >= 80 ? '超高同步' : avg >= 65 ? '高同步' : avg >= 45 ? '可發展' : '待觀察';

  const rarity = getRarity(score);
  const rarityClass = rarity ? ` rarity-${rarity.tier}` : '';
  const rarityShineHtml = rarity?.tier === 'ssr' ? '<div class="rarity-shine"></div>' : '';

  // Intelligence summary section HTML
  const intSummary = intelligence?.summary;
  // Status indicator colour based on summary type
  const typeStr = intSummary?.type || '';
  const statusColor = (typeStr === '\u9748\u9b42\u4f34\u4f36\u5019\u9078' || typeStr === '\u9ad8\u5ea6\u5951\u5408')
    ? '#34d399'
    : (typeStr === '\u5024\u5f97\u6df1\u5165\u4e86\u89e3' || typeStr.includes('\u6f5b\u529b'))
    ? '#fbbf24'
    : '#f87171';
  const summaryHtml = intSummary ? `
    <div class="intel-box">
      <div class="intel-type" style="border-color:${statusColor};color:${statusColor}"><span class="status-dot" style="background:${statusColor}"></span>${escHtml(intSummary.type || '')}</div>
      <div class="intel-text">${escHtml(intSummary.text || '')}</div>
      ${intSummary.persona ? `<div class="intel-row" style="margin-bottom:4px"><span class="intel-tag persona">${escHtml(intSummary.persona)}</span></div>` : ''}
      ${(intSummary.strengths || []).length ? `<div class="intel-row"><span class="intel-tag green">💚 ${(intSummary.strengths).join('</span><span class="intel-tag green">💚 ')}</span></div>` : ''}
      ${(intSummary.risks || []).length ? `<div class="intel-row"><span class="intel-tag red">🐾 ${(intSummary.risks).join('</span><span class="intel-tag red">🐾 ')}</span></div>` : ''}
    </div>` : '';

  // legendCols removed — legend replaced by inline vertex percentages

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content" />
<title>Black Cat Match Card</title>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #07060e;
    --panel: #12111d;
    --panel2: #1a1830;
    --line: #2a2650;
    --cyan: #00e5ff;
    --pink: #ff6b9d;
    --yellow: #ffe066;
    --text: #f0ebd8;
    --dim: #a09c8c;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html {
    overflow-x: clip;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    height: auto;
    min-height: 100%;
  }
  body {
    background:
      radial-gradient(circle at 50% -20%, rgba(0,229,255,0.12), transparent 55%),
      radial-gradient(circle at 80% 80%, rgba(120,80,220,0.08), transparent 40%),
      #0d0b1a;
    color: var(--text);
    font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
    overflow-x: clip;
    overflow-y: visible;
    touch-action: pan-y;
    padding: 20px 14px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    min-height: 100%;
    height: auto;
  }
  .card {
    width: min(100%, 520px);
    margin: 0 auto;
    padding: 18px 16px;
    background: linear-gradient(180deg, rgba(26,24,48,0.92), rgba(12,11,22,0.96));
    border: 2px solid var(--cyan);
    border-radius: 4px;
    box-shadow: 0 0 28px rgba(0,229,255,0.18);
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    border-radius: 2px;
    background:
      radial-gradient(circle at 88% 10%, rgba(255,224,102,0.08), transparent 32%),
      radial-gradient(circle at 14% 22%, rgba(255,255,255,0.04), transparent 24%);
  }
  .card > *:not(#card-stars) {
    position: relative;
    z-index: 1;
  }
  @media (max-width: 520px) {
    body { padding: 4px 10px calc(20px + env(safe-area-inset-bottom, 0px)); }
    .card {
      width: min(100%, calc(100% - 4px));
      padding: 14px 11px 16px;
      border-width: 2px;
      box-shadow: 0 0 24px rgba(0,229,255,0.16);
    }
    .card-header {
      gap: 8px;
      margin-bottom: 8px;
    }
    .card-header-center { gap: 10px; }
    .card-header svg { width: 38px !important; height: 38px !important; }
    .site-label { font-size: 7px; line-height: 1.5; }
    .rarity-badge {
      font-size: 10px;
      height: 28px;
      padding: 0 10px;
      letter-spacing: 2px;
    }
    h1 {
      font-size: 20px;
      letter-spacing: 1px;
      margin: 2px 0 4px;
    }
    .subtitle {
      font-size: 12px;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .match-summary {
      padding: 12px 10px;
      margin-bottom: 12px;
    }
    .match-summary > div:first-child {
      font-size: 13px;
      line-height: 1.55;
    }
    .match-line {
      font-size: 18px !important;
      margin: 8px 0 10px;
      gap: 8px !important;
      flex-wrap: wrap;
      line-height: 1.35;
    }
    .match-line svg { width: 34px !important; height: 34px !important; }
    .match-line > div { min-width: 0; flex: 1 1 140px; }
    .score-tag {
      font-size: 11px;
      padding: 4px 10px;
    }
    .meta {
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 10px;
      font-size: 11px;
    }
    .meta-col { gap: 5px; }
    .meta-col > div {
      flex-wrap: wrap;
      line-height: 1.45;
    }
    .meta-label { margin-right: 2px; }
    .radar-wrap {
      margin-top: 12px;
      padding: 10px 8px;
    }
    .radar-title {
      font-size: 12px;
      margin-bottom: 6px;
      letter-spacing: 1px;
    }
    .radar-wrap svg {
      max-width: 100%;
      max-height: 220px;
    }
    .intel-box {
      margin-top: 12px;
      padding: 12px 10px;
    }
    .intel-type { font-size: 10px; padding: 3px 10px; margin-bottom: 8px; }
    .intel-text { font-size: 13px; line-height: 1.65; margin-bottom: 8px; }
    .intel-row { gap: 5px; margin-top: 4px; }
    .intel-tag { font-size: 10px; padding: 3px 8px; }
    .intel-tag.persona { font-size: 11px; padding: 3px 10px; }
    .footer { margin-top: 16px; padding-top: 12px; }
    .footer-cta { gap: 10px; margin-bottom: 10px; }
    .footer-cta img { width: 56px; height: 56px; }
    .footer-cta-text .cta-main { font-size: 12px; }
    .footer-cta-text .cta-sub { font-size: 10px; }
    .dl-wrap { margin-top: 12px; padding: 0; }
    .dl-btn { font-size: 13px; padding: 10px 24px; }
    .privacy-toggle { font-size: 12px; margin-bottom: 8px; }
  }
  /* Header with pixel cat */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .card-header-center {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    justify-content: center;
  }
  .site-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: var(--yellow);
    line-height: 1.6;
    text-shadow: 0 0 8px rgba(255,224,102,0.3);
  }
  h1 {
    margin: 4px 0 6px;
    color: var(--yellow);
    font-size: 20px;
    letter-spacing: 1px;
    text-align: center;
    text-shadow: 0 0 12px rgba(255,224,102,0.2);
  }
  .subtitle {
    color: var(--dim);
    font-size: 12px;
    margin-bottom: 12px;
    text-align: center;
  }
  .match-summary {
    background: rgba(11,10,21,0.65);
    border: 2px solid var(--line);
    border-radius: 4px;
    padding: 14px;
    margin-bottom: 12px;
  }
  .match-summary > div:first-child {
    font-size: 13px;
  }
  .match-line {
    font-size: 22px;
    color: var(--cyan);
    font-weight: 900;
    margin: 8px 0 10px;
    letter-spacing: 0.5px;
    text-shadow: 0 0 16px rgba(0,229,255,0.3);
  }
  .score-tag {
    display: inline-block;
    padding: 4px 10px;
    border: 1px solid var(--pink);
    border-radius: 3px;
    color: var(--pink);
    font-size: 12px;
    font-weight: 700;
  }
  .meta {
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
    font-size: 11px;
    color: #7a7590;
    align-items: start;
  }
  .meta-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .meta-col > div {
    display: flex;
    align-items: flex-start;
    flex-wrap: nowrap;
  }
  .meta-label {
    white-space: nowrap;
    flex-shrink: 0;
    margin-right: 3px;
  }
  .meta span {
    color: #7dd8e4;
    font-weight: 700;
    word-break: break-all;
    min-width: 0;
  }
  /* 曬命模式：隱藏聯絡資料 */
  .card.privacy-on .meta { display: none; }
  .privacy-name-blur { display: inline-block; }
  .card.privacy-on .privacy-name-blur { filter: blur(7px); user-select: none; }
  .privacy-age-blur { display: inline-block; }
  .card.privacy-on .privacy-age-blur { filter: blur(5px); user-select: none; }
  .privacy-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #a89cc8;
    font-family: 'Noto Sans TC', sans-serif;
    font-size: 14px;
    margin-bottom: 12px;
    user-select: none;
  }
  .privacy-toggle input { accent-color: #7c5cfc; width: 16px; height: 16px; cursor: pointer; }
  .radar-wrap {
    margin-top: 14px;
    padding: 10px;
    background: rgba(18,17,29,0.5);
    border: 2px solid var(--line);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .radar-wrap svg { width: 100%; max-width: 280px; max-height: 240px; display: block; }
  .radar-title {
    text-align: center;
    font-size: 12px;
    color: var(--cyan);
    font-weight: 700;
    margin-bottom: 6px;
    letter-spacing: 1px;
  }
  .legend {
    display: none;
  }

  /* ── Rarity badge ─────────────────────────────────────────── */
  .rarity-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
    letter-spacing: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0 10px;
    line-height: 1;
    border-radius: 3px;
    border: 2px solid transparent;
    color: #07060e;
    font-weight: 900;
    text-shadow: none;
    user-select: none;
    flex-shrink: 0;
  }
  .rarity-badge-phantom {
    flex-shrink: 0;
    visibility: hidden;
  }
  /* SSR — sliding gold shimmer + glow pulse */
  .rarity-badge.ssr {
    background: linear-gradient(90deg,
      #5c3900 0%, #ffd700 20%, #fff7a0 38%, #ffffff 50%, #fff7a0 62%, #ffd700 80%, #5c3900 100%
    );
    background-size: 300% 100%;
    border-color: #ffd700;
    color: #07060e;
    animation: ssr-badge-shine 5s ease-in-out infinite, ssr-badge-glow 5s ease-in-out infinite;
  }
  @keyframes ssr-badge-shine {
    0%             { background-position: 0% 50%; }
    22%            { background-position: 300% 50%; }
    22.001%, 100%  { background-position: 0% 50%; }
  }
  @keyframes ssr-badge-glow {
    0%, 15%, 100%  { box-shadow: 0 0 10px rgba(255,215,0,0.65), 0 0 22px rgba(255,215,0,0.28); }
    10%            { box-shadow: 0 0 22px rgba(255,215,0,1), 0 0 40px rgba(255,215,0,0.55), 0 0 6px rgba(255,247,160,0.9); }
  }
  /* SR — sliding silver shimmer + glow pulse */
  .rarity-badge.sr {
    background: linear-gradient(90deg,
      #2e2e3e 0%, #b0b0c8 18%, #e8e8ff 36%, #ffffff 50%, #e8e8ff 64%, #b0b0c8 82%, #2e2e3e 100%
    );
    background-size: 300% 100%;
    border-color: #c8c8d8;
    color: #07060e;
    animation: sr-badge-shine 7s ease-in-out infinite, sr-badge-glow 7s ease-in-out infinite;
  }
  @keyframes sr-badge-shine {
    0%             { background-position: 0% 50%; }
    20%            { background-position: 300% 50%; }
    20.001%, 100%  { background-position: 0% 50%; }
  }
  @keyframes sr-badge-glow {
    0%, 14%, 100%  { box-shadow: 0 0 8px rgba(200,200,220,0.55), 0 0 16px rgba(200,200,220,0.18); }
    10%            { box-shadow: 0 0 18px rgba(220,220,255,0.9), 0 0 32px rgba(200,200,220,0.42); }
  }
  /* R — sliding bronze shimmer + glow pulse */
  .rarity-badge.r {
    background: linear-gradient(90deg,
      #3a1800 0%, #cd7f32 18%, #f0a050 36%, #ffcc77 50%, #f0a050 64%, #cd7f32 82%, #3a1800 100%
    );
    background-size: 300% 100%;
    border-color: #cd7f32;
    color: #07060e;
    animation: r-badge-shine 9s ease-in-out infinite, r-badge-glow 9s ease-in-out infinite;
  }
  @keyframes r-badge-shine {
    0%             { background-position: 0% 50%; }
    18%            { background-position: 300% 50%; }
    18.001%, 100%  { background-position: 0% 50%; }
  }
  @keyframes r-badge-glow {
    0%, 12%, 100%  { box-shadow: 0 0 8px rgba(205,127,50,0.55), 0 0 16px rgba(205,127,50,0.18); }
    8%             { box-shadow: 0 0 16px rgba(240,160,80,0.85), 0 0 28px rgba(205,127,50,0.42), 0 0 5px rgba(255,204,119,0.75); }
  }

  /* ── SSR sweeping card shine overlay ─────────────────────── */
  .rarity-shine {
    position: absolute;
    top: 0;
    left: -80%;
    width: 55%;
    height: 100%;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255,215,0,0.055) 50%,
      transparent 70%
    );
    pointer-events: none;
    z-index: 2;
    animation: card-shine-sweep 5s ease-in-out infinite;
  }
  @keyframes card-shine-sweep {
    0%   { left: -80%; opacity: 0; }
    15%  { opacity: 1; }
    60%  { left: 130%; opacity: 1; }
    75%  { left: 130%; opacity: 0; }
    100% { left: -80%; opacity: 0; }
  }

  /* ── Card border tinting per rarity ──────────────────────── */
  .card.rarity-ssr {
    border-color: #ffd700;
    animation: ssr-card-pulse 3s ease-in-out infinite;
  }
  @keyframes ssr-card-pulse {
    0%, 100% { box-shadow: 0 0 40px rgba(255,215,0,0.45); }
    50%       { box-shadow: 0 0 64px rgba(255,215,0,0.72), inset 0 0 32px rgba(255,215,0,0.06); }
  }
  .card.rarity-sr {
    border-color: #c0c0d0;
    box-shadow: 0 0 40px rgba(200,200,220,0.4);
  }
  .card.rarity-r {
    border-color: #cd7f32;
    box-shadow: 0 0 40px rgba(205,127,50,0.4);
  }

  /* Intelligence summary */
  .intel-box {
    margin-top: 12px;
    padding: 12px 14px;
    background: rgba(14,13,26,0.9);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }
  .intel-type {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border: 1px solid var(--cyan);
    border-radius: 16px;
    color: var(--cyan);
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 6px currentColor;
    animation: pulse-glow 2s ease-in-out infinite;
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 5px currentColor; opacity: 1; }
    50% { box-shadow: 0 0 14px currentColor, 0 0 24px currentColor; opacity: 0.8; }
  }
  .no-anim * { animation: none !important; transition: none !important; }
  .intel-text {
    font-size: 13px;
    color: var(--text);
    line-height: 1.7;
    margin-bottom: 10px;
  }
  .intel-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 5px;
  }
  .intel-tag {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 16px;
    font-weight: 600;
    line-height: 1.45;
  }
  .intel-tag.green {
    background: rgba(52,211,153,0.12);
    color: #34d399;
    border: 1px solid rgba(52,211,153,0.3);
    box-shadow: 0 0 8px rgba(52,211,153,0.2);
  }
  .intel-tag.red {
    background: rgba(239,68,68,0.10);
    color: #f87171;
    border: 1px solid rgba(239,68,68,0.25);
    box-shadow: 0 0 8px rgba(248,113,113,0.2);
  }
  .intel-tag.persona {
    background: linear-gradient(135deg, rgba(180,79,255,0.18), rgba(0,229,255,0.12));
    color: #d8b4fe;
    border: 1px solid rgba(180,79,255,0.4);
    box-shadow: 0 0 10px rgba(180,79,255,0.2);
    font-size: 12px;
    padding: 4px 12px;
    letter-spacing: 0.02em;
  }
  .footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(90,84,127,0.4);
    text-align: center;
  }
  .footer-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .footer-cta img {
    display: block;
    border-radius: 6px;
    background: #fff;
    padding: 3px;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
  }
  .footer-cta-text {
    text-align: left;
  }
  .footer-cta-text .cta-main {
    font-size: 14px;
    font-weight: 700;
    color: #c8b8ff;
    line-height: 1.5;
  }
  .footer-cta-text .cta-sub {
    font-size: 12px;
    color: #6a6488;
    margin-top: 3px;
  }
  .footer-copy {
    font-size: 11px;
    color: #46435a;
    letter-spacing: 0.5px;
  }
  .dl-wrap {
    width: 100%;
    max-width: 400px;
    margin: 16px auto 0;
    text-align: center;
    box-sizing: border-box;
    padding: 0 8px;
  }
  .dl-btn {
    display: inline-block;
    padding: 12px 36px;
    background: linear-gradient(135deg, #7c5cfc, #5b7fff);
    color: #fff;
    font-family: 'Noto Sans TC', sans-serif;
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: opacity .15s;
  }
  .dl-btn:hover { opacity: 0.85; }
  .dl-btn:disabled { opacity: 0.5; cursor: not-allowed; }

</style>
</head>
<body>
  <div class="card${rarityClass}">
    <!-- Animated starfield canvas -->
    <canvas id="card-stars" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;border-radius:2px;opacity:0.55"></canvas>
    ${rarityShineHtml}
    <!-- Pixel Cat Header -->
    <div class="card-header" style="position:relative;z-index:1">
      ${rarity ? `<div class="rarity-badge ${rarity.tier}">${rarity.label}</div>` : '<div style="width:0"></div>'}
      <div class="card-header-center">
        ${buildPixelCat('', 40, 40)}
        <div class="site-label">Black Cat<br>Under The Moon</div>
      </div>
      ${rarity ? `<div class="rarity-badge rarity-badge-phantom">${rarity.label}</div>` : '<div style="width:0"></div>'}
    </div>

    <h1>🌙 靈魂共鳴連線通知</h1>
    <div class="subtitle">靈貓為你分析心靈契合度，尋找靈魂同頻者</div>

    <div class="match-summary">
      <div style="margin-bottom:6px;">恭喜 <span style="color:var(--yellow);font-weight:700;">${escHtml(user.name)}</span><span style="color:#a89cc8;font-size:0.7em;margin-left:8px;">(${escHtml(user.identity || 'No Label')} · <span class="privacy-age-blur">${user.age ? user.age + '歲' : ''}</span>)</span> 成功連線：</div>
      <div class="match-line" style="display:flex;align-items:center;gap:10px;">${buildPixelCat(target.identity, 36, 36)}<div>${escHtml(target.name[0] || '')}${target.name.length > 1 ? `<span class="privacy-name-blur">${escHtml(target.name.slice(1))}</span>` : ''}<span style="color:#a89cc8;font-size:0.55em;font-weight:400;margin-left:10px;white-space:nowrap;">(${escHtml(target.identity || 'No Label')}${target.age ? ' · <span class="privacy-age-blur">' + target.age + '歲</span>' : ''})</span></div></div>
      <div class="score-tag">同步率 ${score}/100 ・ ${avgLabel}</div>
      <div class="meta">
        <div class="meta-col">${[
          user.email       ? `<div><span class="meta-label">你的 Email：</span><span>${escHtml(user.email)}</span></div>` : '',
          user.ig_username ? `<div><span class="meta-label">你的 IG：</span><span>${escHtml(user.ig_username)}</span></div>` : '',
          user.tg_username ? `<div><span class="meta-label">你的 TG：</span><span>${escHtml(user.tg_username)}</span></div>` : ''
        ].filter(Boolean).join('')}</div>
        <div class="meta-col">${[
          target.email       ? `<div><span class="meta-label">對方 Email：</span><span>${escHtml(target.email)}</span></div>` : '',
          target.ig_username ? `<div><span class="meta-label">對方 IG：</span><span>${escHtml(target.ig_username)}</span></div>` : '',
          target.tg_username ? `<div><span class="meta-label">對方 TG：</span><span>${escHtml(target.tg_username)}</span></div>` : ''
        ].filter(Boolean).join('')}</div>
      </div>
    </div>

    <div class="radar-wrap">
      <div class="radar-title">共鳴雷達圖</div>
      <svg width="100%" viewBox="0 0 520 455" role="img" aria-label="match radar chart">
        <defs>
          <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g stroke="#5a547f" fill="none" stroke-width="1.5">
          <polygon points="${gridPoly(1)}"></polygon>
          <polygon points="${gridPoly(0.66)}"></polygon>
          <polygon points="${gridPoly(0.33)}"></polygon>
          ${Array.from({length: numAxes}, (_, i) => {
            const angle = (-90 + i * (360 / numAxes)) * (Math.PI / 180);
            const ex = cx + Math.cos(angle) * radius;
            const ey = cy + Math.sin(angle) * radius;
            return `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"></line>`;
          }).join('')}
        </g>
        <polygon points="${polygon}" fill="rgba(0,229,255,0.08)" stroke="#00e5ff" stroke-width="5" filter="url(#radar-glow)" opacity="0.45"></polygon>
        <polygon points="${polygon}" fill="rgba(0,229,255,0.20)" stroke="#00e5ff" stroke-width="2.5"></polygon>
        <g font-weight="700" text-rendering="geometricPrecision">
          ${labelPos.map((p, i) => `<text x="${p.x}" y="${p.y}" text-anchor="${p.anchor}"><tspan fill="#ffe066" font-size="16">${radarLabels[i]}</tspan><tspan x="${p.pcx}" dy="20" fill="#00e5ff" font-size="13" text-anchor="middle">${radarValues[i]}%</tspan></text>`).join('')}
        </g>
      </svg>
    </div>

    ${summaryHtml}

    <div class="footer">
      <div class="footer-cta">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=88x88&format=png&data=${encodeURIComponent(siteUrl)}" width="44" height="44" crossorigin="anonymous" alt="掃碼連線"/>
        <div class="footer-cta-text">
          <div class="cta-main">想找你的靈魂知己？<br>掃碼測試，靈貓幫你分析共鳴 🐈‍⬛</div>
          <div class="cta-sub">${siteHost}</div>
        </div>
      </div>
      <div class="footer-copy">Black Cat Under The Moon &nbsp;·&nbsp; blcatunderthemoon@gmail.com</div>
    </div>
  </div>

  <div class="dl-wrap">
    <div><label class="privacy-toggle"><input type="checkbox" id="privacyToggle" onchange="document.querySelector('.card').classList.toggle('privacy-on', this.checked)"> 🙈 曬命模式（隱藏聯絡資料）</label></div>
    <button class="dl-btn" id="dlBtn" onclick="downloadCard()">&#x1F4E5; 下載共鳴分析卡 (PNG)</button>
  </div>

  <!-- Post-download donate popup -->
  <div id="donate-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(4,3,14,0.82);backdrop-filter:blur(4px);align-items:center;justify-content:center;">
    <div style="background:linear-gradient(160deg,#1a1630,#0f0c20);border:1px solid rgba(180,143,255,0.4);border-radius:16px;padding:32px 28px 24px;max-width:420px;width:90%;text-align:center;position:relative;box-shadow:0 0 40px rgba(124,92,252,0.25);font-family:'Noto Sans TC',sans-serif;">
      <button onclick="document.getElementById('donate-modal').style.display='none'" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#6a6488;font-size:18px;cursor:pointer;line-height:1;">✕</button>
      <div style="font-size:36px;margin-bottom:12px;">🥫</div>
      <div style="font-size:16px;font-weight:700;color:#e0d4ff;margin-bottom:8px;">怕黑貓餓到罷工？</div>
      <div style="font-size:13px;color:#8880a8;line-height:1.7;margin-bottom:22px;">這張卡片漂亮嗎？<br>投餵一罐罐頭，靈貓繼續幫你分析共鳴 🐈‍⬛</div>
      <a href="https://ko-fi.com/blackcatunderthemoon" target="_blank" rel="noopener noreferrer"
         style="display:inline-flex;align-items:center;gap:8px;padding:11px 28px;background:linear-gradient(135deg,#ff5e5b,#ff8c42);border:none;border-radius:8px;text-decoration:none;color:#fff;font-size:14px;font-weight:700;font-family:'Noto Sans TC',sans-serif;">
        🥫 投餵一罐罐頭
      </a>
      <div style="margin-top:14px;">
        <button onclick="document.getElementById('donate-modal').style.display='none'" style="background:none;border:none;color:#46435a;font-size:11px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;">黑貓唔餓，下次先</button>
      </div>
    </div>
  </div>

  <script>
    function ensureHtml2Canvas() {
      if (typeof html2canvas !== 'undefined') return Promise.resolve();
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    function prefetchImageDataUrl(img) {
      if (!img || !img.src || String(img.src).indexOf('data:') === 0) {
        return Promise.resolve(img ? img.src : null);
      }
      return fetch(img.src, { mode: 'cors', credentials: 'omit' })
        .then(function(resp) { return resp.ok ? resp.blob() : null; })
        .then(function(blob) {
          if (!blob) return null;
          return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = function() { resolve(null); };
            reader.readAsDataURL(blob);
          });
        })
        .catch(function() { return null; });
    }

    function downloadBlob(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.download = filename;
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    function canvasToPngBlob(canvas) {
      return new Promise(function(resolve, reject) {
        if (!canvas.toBlob) {
          try {
            resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
          } catch (err) {
            reject(err);
          }
          return;
        }
        canvas.toBlob(function(blob) {
          if (blob) resolve(blob);
          else {
            try { resolve(dataUrlToBlob(canvas.toDataURL('image/png'))); }
            catch (err) { reject(err); }
          }
        }, 'image/png');
      });
    }

    function dataUrlToBlob(dataUrl) {
      var parts = String(dataUrl).split(',');
      var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
      var bin = atob(parts[1] || '');
      var len = bin.length;
      var arr = new Uint8Array(len);
      for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
  </script>
  <script>
    // ===== CARD STARFIELD (mirrors index.html initStarfield) =====
    (function initCardStarfield() {
      var canvas = document.getElementById('card-stars');
      var card = document.querySelector('.card');
      var ctx = canvas.getContext('2d');
      canvas.width = card.offsetWidth;
      canvas.height = card.offsetHeight;
      var stars = [];
      for (var i = 0; i < 48; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() < 0.25 ? 2 : 1,
          speed: Math.random() * 0.12 + 0.04,
          phase: Math.random() * Math.PI * 2,
          twinkle: Math.random() * 0.012 + 0.004
        });
      }
      var colors = ['255,255,255', '200,180,255', '180,230,255'];
      var paused = false;
      function draw(time) {
        if (!paused) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          stars.forEach(function(s) {
            s.y += s.speed;
            if (s.y > canvas.height + 2) { s.y = -2; s.x = Math.random() * canvas.width; }
            var alpha = 0.18 + 0.22 * Math.sin(time * s.twinkle + s.phase);
            var c = colors[(s.size + Math.floor(s.x)) % colors.length];
            ctx.fillStyle = 'rgba(' + c + ',' + alpha.toFixed(2) + ')';
            ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
          });
        }
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
      window._cardStarsPause = function(v) {
        paused = v;
        // Clear canvas when pausing so PNG export has a clean bg (no mid-animation freeze)
        if (v) ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
    })();

    function downloadCard() {
      var btn = document.getElementById('dlBtn');
      btn.disabled = true;
      btn.textContent = '\u751f\u6210\u4e2d\u2026';

      var card = document.querySelector('.card');
      if (!card) {
        btn.disabled = false;
        btn.textContent = '\u4e0b\u8f09\u5931\u6557\uff0c\u8acb\u91cd\u8a66';
        return;
      }

      if (typeof window._cardStarsPause === 'function') window._cardStarsPause(true);

      var rect = card.getBoundingClientRect();
      var exportW = Math.max(Math.round(rect.width), 280);
      var exportH = Math.max(Math.ceil(rect.height), card.scrollHeight, 480);
      var exportCard = card.cloneNode(true);
      exportCard.style.cssText =
        'position:fixed;left:-10000px;top:0;width:' + exportW + 'px;height:' + exportH + 'px;min-height:auto;margin:0;z-index:-1;overflow:hidden;box-sizing:border-box;';
      document.body.appendChild(exportCard);

      var exportStars = exportCard.querySelector('#card-stars');
      if (exportStars) exportStars.remove();

      var privacyOn = document.getElementById('privacyToggle').checked;
      if (privacyOn) {
        exportCard.querySelectorAll('.privacy-name-blur, .privacy-age-blur').forEach(function(el) {
          el.style.color = 'transparent';
          el.style.background = '#3a3560';
          el.style.borderRadius = '3px';
          el.style.overflow = 'hidden';
          el.style.verticalAlign = 'middle';
        });
        exportCard.querySelectorAll('.meta').forEach(function(el) {
          el.style.display = 'none';
        });
      }

      function cleanup() {
        if (exportCard.parentNode) exportCard.parentNode.removeChild(exportCard);
        document.body.classList.remove('no-anim');
        if (typeof window._cardStarsPause === 'function') window._cardStarsPause(false);
      }

      function failDownload() {
        cleanup();
        btn.disabled = false;
        btn.textContent = '\u4e0b\u8f09\u5931\u6557\uff0c\u8acb\u91cd\u8a66';
      }

      document.body.classList.add('no-anim');

      var imgTasks = Array.prototype.map.call(exportCard.querySelectorAll('img'), function(img) {
        return prefetchImageDataUrl(img).then(function(dataUrl) {
          if (dataUrl) img.src = dataUrl;
          else img.style.visibility = 'hidden';
        });
      });

      Promise.all(imgTasks).then(function() {
        return new Promise(function(resolve) {
          requestAnimationFrame(function() { requestAnimationFrame(resolve); });
        });
      }).then(function() {
        return ensureHtml2Canvas();
      }).then(function() {
        return html2canvas(exportCard, {
          scale: 2,
          backgroundColor: '#0d0b1a',
          useCORS: true,
          allowTaint: false,
          logging: false,
          width: exportW,
          height: exportH,
          windowWidth: exportW,
          windowHeight: exportH,
        });
      }).then(function(canvas) {
        return canvasToPngBlob(canvas).then(function(blob) {
          cleanup();
          downloadBlob(blob, 'match_${user.name.replace(/[^\w\u4e00-\u9fff]/g,'_')}_x_${target.name.replace(/[^\w\u4e00-\u9fff]/g,'_')}.png');
          btn.disabled = false;
          btn.textContent = '\u4e0b\u8f09\u914d\u5c0d\u5361\u7247 (PNG)';
          var modal = document.getElementById('donate-modal');
          modal.style.display = 'flex';
        });
      }).catch(function(err) {
        console.error('Match card download failed:', err);
        failDownload();
      });
    }
  </script>
</body>
</html>`;
}


export { buildMatchCardHtml, clampScore };
