#!/usr/bin/env node
/**
 * Matching Algorithm Test Suite — Black Cat Under The Moon
 * Uses correct DB column names from api/submit.js and api/match.js
 * Usage: node scripts/test-matching.mjs [--userId=<id>] [--generateCards]
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '../.env.local');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env.local not found, rely on existing env */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// ============================================================
// Matching algorithm — mirrors pages/api/match.js exactly
// ============================================================

/** Split comma-separated string into a trimmed Set */
function parseCSV(str) {
  if (!str) return new Set();
  return new Set(str.split(',').map((s) => s.trim()).filter(Boolean));
}

/** Parse ideal_height_gap / ideal_age_gap stored as JSON "[min,max]" or null */
function parseRange(raw) {
  if (raw == null) return null;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length === 2) {
      return { min: Number(arr[0]), max: Number(arr[1]) };
    }
  } catch { /* ignore */ }
  return null;
}

/** Extract Top / Bottom / Switch from bed_role string */
function getBedRole(str) {
  if (!str) return 'unknown';
  if (str.includes('Top')) return 'Top';
  if (str.includes('Bottom')) return 'Bottom';
  if (str.includes('Switch')) return 'Switch';
  return 'neutral';
}

/**
 * Identity filter (dual-direction):
 * user's identity must be in candidate's ideal_identity (or candidate chose 冇所謂)
 * AND candidate's identity must be in user's ideal_identity (or user chose 冇所謂)
 */
function passesIdentityFilter(user, candidate) {
  const userIdeal = parseCSV(user.ideal_identity);
  const candidateIdeal = parseCSV(candidate.ideal_identity);

  const userAcceptsCandidate =
    userIdeal.has('冇所謂') || userIdeal.has(candidate.identity);
  const candidateAcceptsUser =
    candidateIdeal.has('冇所謂') || candidateIdeal.has(user.identity);

  return userAcceptsCandidate && candidateAcceptsUser;
}

/** Body type filter (dual-direction) */
function passesBodyTypeFilter(user, candidate) {
  const userPref = parseCSV(user.ideal_appearance);
  const candidatePref = parseCSV(candidate.ideal_appearance);
  const userAccepts = userPref.size === 0 || userPref.has('冇所謂') || userPref.has(candidate.body_type);
  const candidateAccepts = candidatePref.size === 0 || candidatePref.has('冇所謂') || candidatePref.has(user.body_type);
  return userAccepts && candidateAccepts;
}

/** Height gap filter (dual-direction) */
function passesHeightFilter(user, candidate) {
  if (user.height == null || candidate.height == null) return true;
  const cRange = parseRange(candidate.ideal_height_gap);
  if (cRange != null) {
    const diff = user.height - candidate.height;
    if (diff < cRange.min || diff > cRange.max) return false;
  }
  const uRange = parseRange(user.ideal_height_gap);
  if (uRange != null) {
    const diff = candidate.height - user.height;
    if (diff < uRange.min || diff > uRange.max) return false;
  }
  return true;
}

/** Age gap filter (dual-direction) */
function passesAgeFilter(user, candidate) {
  if (user.age == null || candidate.age == null) return true;
  const cRange = parseRange(candidate.ideal_age_gap);
  if (cRange != null) {
    const diff = user.age - candidate.age;
    if (diff < cRange.min || diff > cRange.max) return false;
  }
  const uRange = parseRange(user.ideal_age_gap);
  if (uRange != null) {
    const diff = candidate.age - user.age;
    if (diff < uRange.min || diff > uRange.max) return false;
  }
  return true;
}

/** Combined hard filter */
function passesHardFilter(user, candidate) {
  return passesIdentityFilter(user, candidate)
    && passesBodyTypeFilter(user, candidate)
    && passesHeightFilter(user, candidate)
    && passesAgeFilter(user, candidate);
}

/** bed_role complementarity — 20 pts (Top↔Bottom), 15 pts (Switch↔any), 5 pts (same), 10 pts (other) */
function scoreBedRole(userRole, candidateRole) {
  const u = getBedRole(userRole);
  const c = getBedRole(candidateRole);
  if ((u === 'Top' && c === 'Bottom') || (u === 'Bottom' && c === 'Top')) return 20;
  if (u === 'Switch' || c === 'Switch') return 15;
  if (u === c) return 5;
  return 10;
}

/** love_languages overlap — 10 pts per overlap, max 20 */
function scoreLoveLanguage(userLL, candidateLL) {
  const uSet = parseCSV(userLL);
  const cSet = parseCSV(candidateLL);
  let overlap = 0;
  for (const item of uSet) {
    if (cSet.has(item)) overlap++;
  }
  return Math.min(overlap * 10, 20);
}

/** social_energy + weekend_mode exact match — 10 pts each, max 20 */
function scoreSocialWeekend(user, candidate) {
  let score = 0;
  if (user.social_energy && user.social_energy === candidate.social_energy) score += 10;
  if (user.weekend_mode && user.weekend_mode === candidate.weekend_mode) score += 10;
  return score;
}

/** Values: communication_style (+8), expense_splitting (+6), living_together (+6), max 20 */
function scoreValues(user, candidate) {
  let score = 0;
  if (user.communication_style && user.communication_style === candidate.communication_style) score += 8;
  if (user.expense_splitting && user.expense_splitting === candidate.expense_splitting) score += 6;
  if (user.living_together && user.living_together === candidate.living_together) score += 6;
  return score;
}

function calculateMatchScore(user, candidate) {
  const bedRole  = scoreBedRole(user.bed_role, candidate.bed_role);
  const loveLang = scoreLoveLanguage(user.love_languages, candidate.love_languages);
  const social   = scoreSocialWeekend(user, candidate);
  const values   = scoreValues(user, candidate);
  return {
    total: bedRole + loveLang + social + values,
    breakdown: { bedRole, loveLang, social, values },
  };
}

// ============================================================
// HTML match card generation
// ============================================================

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toRadarPercent(score) {
  return Math.round((score / 20) * 100);
}

/** Derive a pixel-art wildcard tag from user traits */
function getWildcard(u) {
  const se = (u.social_energy || '').toLowerCase();
  const wm = (u.weekend_mode || '').toLowerCase();
  const br = getBedRole(u.bed_role);
  const tags = [];
  if (se.includes('外向') || se.includes('extrovert')) tags.push('ADVENTURER');
  else if (se.includes('內向') || se.includes('introvert')) tags.push('HOMEBODY');
  else tags.push('VERSATILE');
  if (wm.includes('戶外') || wm.includes('outdoor')) tags.push('EXPLORER');
  else if (wm.includes('宅') || wm.includes('indoor') || wm.includes('home')) tags.push('NESTER');
  if (br === 'Switch') tags.push('WILDCARD');
  return tags.slice(0, 2).join(' · ') || 'MYSTERY';
}

function buildMatchCardHtml({ user, target, score, breakdown }) {
  const r = {
    spark: toRadarPercent(breakdown.bedRole),
    pace: toRadarPercent(breakdown.social),
    talk: toRadarPercent(breakdown.values),
    resonance: toRadarPercent(breakdown.loveLang),
  };

  // Pixel radar: build using small rects on a virtual grid
  // Canvas: 300x230, center 150,108, max radius 78 (in grid units ~13)
  const G = 6; // pixel block size
  const cx = 150, cy = 108;
  const R = 78;
  // Generate pixel grid diamonds and data shape
  function pixelDiamond(frac, stroke, fill, opacity) {
    const d = Math.round(R * frac / G);
    const rects = [];
    // Draw diamond outline by iterating edges
    for (let i = -d; i <= d; i++) {
      const span = d - Math.abs(i);
      // outline only: top+bottom of each row
      rects.push(`<rect x="${cx + i * G - G/2}" y="${cy - span * G - G/2}" width="${G}" height="${G}" fill="${stroke}" opacity="${opacity}"/>`);
      if (span > 0) {
        rects.push(`<rect x="${cx + i * G - G/2}" y="${cy + span * G - G/2}" width="${G}" height="${G}" fill="${stroke}" opacity="${opacity}"/>`);
      }
    }
    return rects.join('');
  }
  // Pixel data shape: fill a diamond defined by 4 axis values
  function pixelDataShape() {
    const top = Math.round(R * r.spark / 100 / G);
    const right = Math.round(R * r.pace / 100 / G);
    const bottom = Math.round(R * r.talk / 100 / G);
    const left = Math.round(R * r.resonance / 100 / G);
    const rects = [];
    // Scan rows from -top to +bottom
    const minY = -top, maxY = bottom;
    for (let row = minY; row <= maxY; row++) {
      // Interpolate left/right extents at this row
      let lExt, rExt;
      if (row <= 0) {
        // Upper half: interpolate between top point (0,-top) and left/right points
        const t = top === 0 ? 0 : (top + row) / top;
        lExt = Math.round(left * t);
        rExt = Math.round(right * t);
      } else {
        // Lower half: interpolate between left/right points and bottom point
        const t = bottom === 0 ? 0 : (bottom - row) / bottom;
        lExt = Math.round(left * t);
        rExt = Math.round(right * t);
      }
      for (let col = -lExt; col <= rExt; col++) {
        rects.push(`<rect x="${cx + col * G - G/2}" y="${cy + row * G - G/2}" width="${G}" height="${G}" fill="rgba(0,229,255,.25)"/>`);
      }
      // Edge pixels glow
      if (lExt > 0 || rExt > 0 || row === minY || row === maxY) {
        if (lExt > 0) rects.push(`<rect x="${cx - lExt * G - G/2}" y="${cy + row * G - G/2}" width="${G}" height="${G}" fill="#00e5ff" opacity=".7"/>`);
        if (rExt > 0) rects.push(`<rect x="${cx + rExt * G - G/2}" y="${cy + row * G - G/2}" width="${G}" height="${G}" fill="#00e5ff" opacity=".7"/>`);
        if (row === minY || row === maxY) {
          for (let col = -Math.min(lExt, 1); col <= Math.min(rExt, 1); col++) {
            rects.push(`<rect x="${cx + col * G - G/2}" y="${cy + row * G - G/2}" width="${G}" height="${G}" fill="#00e5ff" opacity=".7"/>`);
          }
        }
      }
    }
    return rects.join('');
  }
  // Pixel axes
  function pixelAxes() {
    const maxD = Math.round(R / G);
    const rects = [];
    for (let i = -maxD; i <= maxD; i++) {
      rects.push(`<rect x="${cx + i * G - G/2}" y="${cy - G/2}" width="${G}" height="${G}" fill="#4c476f" opacity=".5"/>`);
      rects.push(`<rect x="${cx - G/2}" y="${cy + i * G - G/2}" width="${G}" height="${G}" fill="#4c476f" opacity=".5"/>`);
    }
    return rects.join('');
  }

  const radarSvg = `<svg viewBox="0 0 300 230" width="300" height="230" shape-rendering="crispEdges" style="image-rendering:pixelated">
    ${pixelDiamond(0.25, '#4a4580', 'none', '.25')}
    ${pixelDiamond(0.50, '#4a4580', 'none', '.30')}
    ${pixelDiamond(0.75, '#4a4580', 'none', '.35')}
    ${pixelDiamond(1, '#4a4580', 'none', '.4')}
    ${pixelAxes()}
    ${pixelDataShape()}
    <text x="${cx + 6}" y="${cy - Math.round(R * 0.25) - 2}" text-anchor="start" fill="#6a6590" font-size="9" style="font-family:'Press Start 2P',monospace">5</text>
    <text x="${cx + 6}" y="${cy - Math.round(R * 0.50) - 2}" text-anchor="start" fill="#6a6590" font-size="9" style="font-family:'Press Start 2P',monospace">10</text>
    <text x="${cx + 6}" y="${cy - Math.round(R * 0.75) - 2}" text-anchor="start" fill="#6a6590" font-size="9" style="font-family:'Press Start 2P',monospace">15</text>
    <text x="${cx}" y="${cy - R - 8}" text-anchor="middle" fill="#ffe066" font-size="13" font-weight="700" style="font-family:'Noto Sans TC',sans-serif">🔥 火花</text>
    <text x="${cx + R + 8}" y="${cy + 5}" text-anchor="start" fill="#ffe066" font-size="13" font-weight="700" style="font-family:'Noto Sans TC',sans-serif">📅 步調</text>
    <text x="${cx}" y="${cy + R + 16}" text-anchor="middle" fill="#ffe066" font-size="13" font-weight="700" style="font-family:'Noto Sans TC',sans-serif">💬 語頻</text>
    <text x="${cx - R - 8}" y="${cy + 5}" text-anchor="end" fill="#ffe066" font-size="13" font-weight="700" style="font-family:'Noto Sans TC',sans-serif">💞 共鳴</text>
  </svg>`;

  // Pixel bar helper: 20 blocks, proportional fill
  function pixelBar(val, max) {
    const totalBlocks = 20;
    const filled = Math.round((val / max) * totalBlocks);
    return Array.from({length: totalBlocks}, (_, i) => {
      const pct = i / (totalBlocks - 1);
      const cr = Math.round(255 - 255 * pct);
      const cg = Math.round(107 + 122 * pct);
      const cb = Math.round(157 + 98 * pct);
      if (i < filled) {
        return `<div class="bd-block" style="background:rgb(${cr},${cg},${cb});box-shadow:0 0 4px rgba(${cr},${cg},${cb},.6)"></div>`;
      }
      return `<div class="bd-block" style="background:#1a1830"></div>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>配對卡片 — Black Cat Under The Moon</title>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: radial-gradient(circle at 50% -10%, rgba(0,255,255,0.10), transparent 50%), #121212;
      color: #f0ebd8;
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
      padding: 20px;
    }
    .card {
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(180deg, rgba(18,17,29,0.97), rgba(10,9,18,0.99));
      border: 2px solid rgba(0,255,255,.45);
      border-radius: 0;
      padding: 28px 28px 22px;
      box-shadow: 0 0 30px rgba(0,255,255,.10), inset 0 0 60px rgba(0,255,255,.02);
      position: relative;
      overflow: hidden;
    }
    .card::before, .card::after {
      content: ''; position: absolute; width: 10px; height: 10px;
      border: 2px solid #ffe066; pointer-events: none; z-index: 2;
    }
    .card::before { top: -2px; left: -2px; border-right: none; border-bottom: none; }
    .card::after { top: -2px; right: -2px; border-left: none; border-bottom: none; }
    .scanlines {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.06) 2px, rgba(0,0,0,.06) 4px);
      pointer-events: none; z-index: 1;
    }
    .card-header {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; margin-bottom: 2px;
      position: relative; z-index: 1;
    }
    .site-label {
      font-family: 'Press Start 2P', monospace; font-size: 9px;
      color: #ffe066; line-height: 1.6;
      text-shadow: 0 0 8px rgba(255,224,102,0.3);
    }
    .title {
      text-align: center; font-size: 18px; color: #ffe066;
      margin-bottom: 2px; letter-spacing: 3px;
      text-shadow: 0 0 12px rgba(255,224,102,.25);
      position: relative; z-index: 1;
    }
    .score-row {
      text-align: center; margin-bottom: 10px;
      position: relative; z-index: 1;
    }
    .score-big {
      font-size: 56px; font-family: 'Press Start 2P', monospace;
      color: #00ffff;
      text-shadow: 0 0 18px rgba(0,255,255,.7), 0 0 40px rgba(0,255,255,.35), 0 0 80px rgba(0,255,255,.15), 0 2px 0 #0a3a4a;
      -webkit-font-smoothing: none;
      animation: breathe 3s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { text-shadow: 0 0 18px rgba(0,255,255,.7), 0 0 40px rgba(0,255,255,.35), 0 0 80px rgba(0,255,255,.15), 0 2px 0 #0a3a4a; }
      50% { text-shadow: 0 0 24px rgba(0,255,255,.9), 0 0 50px rgba(0,255,255,.45), 0 0 90px rgba(0,255,255,.2), 0 2px 0 #0a3a4a; }
    }
    .score-sep {
      font-size: 28px; font-family: 'Press Start 2P', monospace;
      color: #4a4570; margin: 0 4px;
    }
    .score-max {
      font-size: 22px; font-family: 'Press Start 2P', monospace;
      color: #4a4570;
    }
    .score-sub {
      font-size: 12px; color: #7a7590; margin-bottom: 2px; letter-spacing: 2px;
    }

    /* Users — Fusion Panel */
    .users-panel {
      background: #1a1a2e;
      margin: 8px -4px; padding: 4px;
      position: relative;
      border: none;
    }
    .users-panel-border {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
    }
    .users-panel-border svg { display: block; width: 100%; height: 100%; }
    .users {
      display: flex; justify-content: space-around; align-items: flex-start;
      padding: 18px 12px 14px;
    }
    .user-card { text-align: center; flex: 1; }
    .user-name {
      font-family: 'Press Start 2P', monospace;
      font-size: 15px; line-height: 1.4;
      margin-bottom: 8px; font-weight: 700;
    }
    .user-a .user-name { color: #ff00ff; text-shadow: 0 0 8px rgba(255,0,255,.3); }
    .user-b .user-name { color: #00ffff; text-shadow: 0 0 8px rgba(0,255,255,.3); }
    .user-tag {
      display: inline-block; font-family: 'Press Start 2P', monospace;
      font-size: 8px; padding: 5px 16px; margin-bottom: 4px;
    }
    .user-a .user-tag {
      border: 2px solid #ff00ff; color: #1a0030;
      background: #ff00ff;
      box-shadow: inset 0 -1px 0 rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.35);
    }
    .user-b .user-tag {
      border: 2px solid #00ffff; color: #002030;
      background: #00ffff;
      box-shadow: inset 0 -1px 0 rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.35);
    }

    .user-info {
      font-size: 12px; color: #beb8d4; line-height: 1.5;
    }
    .user-ig {
      font-size: 12px; color: #d4cfe8; margin-top: 4px;
      letter-spacing: 1px;
    }
    .heart-icon { flex-shrink: 0; padding: 10px 8px 0; line-height: 1; }
    /* Radar */
    .radar-section { text-align: center; padding: 18px 0 4px; }
    .radar-section svg { animation: radarPulse 4s ease-in-out infinite; }
    @keyframes radarPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .85; }
    }
    .radar-title {
      font-size: 13px; color: #8a85b0; font-weight: 700;
      margin-bottom: 4px; letter-spacing: 2px;
    }
    /* Breakdown */
    .breakdown {
      margin-top: 6px; padding: 14px 16px;
      background: rgba(42,38,80,0.3);
      border: 1px solid rgba(61,56,112,0.6);
    }
    .bd-title {
      font-size: 14px; color: #ffe066; font-weight: 700;
      margin-bottom: 10px; letter-spacing: 1px;
    }
    .bd-item {
      display: flex; align-items: center;
      padding: 4px 0; font-size: 13px; color: #c8c4b8;
      border-bottom: 1px solid rgba(61,56,112,0.35);
    }
    .bd-item:last-child { border-bottom: none; }
    .bd-label { min-width: 56px; flex-shrink: 0; white-space: nowrap; }
    .bd-bar-wrap {
      flex: 1; margin: 0 8px 0 4px; background: #1a1830;
      height: 14px; overflow: hidden;
      display: flex; padding: 2px; border: 1px solid #2a2650;
    }
    .bd-bar { display: flex; gap: 1px; height: 100%; width: 100%; }
    .bd-block { flex: 1; height: 100%; min-width: 0; }
    .bd-score {
      color: #7ecfcf; font-weight: 700; font-size: 13px;
      min-width: 52px; text-align: right; white-space: nowrap;
    }
    .download-btn {
      display: block; margin: 20px auto 16px; padding: 12px 32px;
      background: transparent;
      color: #00ffff; font-size: 11px; font-weight: 700;
      font-family: 'Press Start 2P', monospace;
      border: 2px solid #00ffff; border-radius: 0; cursor: pointer;
      letter-spacing: 1px; transition: all 0.15s ease;
      box-shadow: none;
      image-rendering: pixelated;
      position: relative;
    }
    .download-btn:hover {
      background: rgba(0,255,255,.08);
      box-shadow: 0 0 12px rgba(0,255,255,.15);
      transform: none;
    }
    .download-btn:active {
      background: rgba(0,255,255,.15);
      transform: translateY(1px);
      box-shadow: none;
    }

    .corner-bl, .corner-br {
      position: absolute; width: 10px; height: 10px;
      border: 2px solid #ffe066; pointer-events: none; z-index: 2;
    }
    .corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
    .corner-br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
    .divider {
      border: none; border-top: 2px solid #3d3870; margin: 4px 0;
      opacity: .4;
    }
    .pixel-stars {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none; z-index: 0; overflow: hidden;
    }
    .pxs {
      position: absolute; width: 3px; height: 3px; background: #ffe066;
      opacity: .10; image-rendering: pixelated;
      animation: twinkle 5s ease-in-out infinite;
    }
    .pxs:nth-child(2) { animation-delay: 1.2s; }
    .pxs:nth-child(3) { animation-delay: 2.8s; }
    .pxs:nth-child(4) { animation-delay: 3.6s; }
    @keyframes twinkle {
      0%, 100% { opacity: .05; }
      50% { opacity: .18; }
    }

  </style>
  <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"><\/script>
</head>
<body>
  <div class="card">
    <div class="scanlines"></div>
    <div class="pixel-stars">
      <div class="pxs" style="top:4%;left:6%"></div>
      <div class="pxs" style="top:6%;right:8%;width:3px;height:3px"></div>
      <div class="pxs" style="bottom:8%;left:8%;width:3px;height:3px"></div>
      <div class="pxs" style="bottom:5%;right:6%"></div>
    </div>
    <div class="card-header">
      <svg viewBox="0 0 32 32" width="48" height="48" shape-rendering="crispEdges" style="image-rendering:pixelated">
        <rect x="6" y="4" width="4" height="4" fill="#3a3660"/>
        <rect x="8" y="2" width="2" height="2" fill="#3a3660"/>
        <rect x="22" y="4" width="4" height="4" fill="#3a3660"/>
        <rect x="22" y="2" width="2" height="2" fill="#3a3660"/>
        <rect x="6" y="8" width="20" height="12" fill="#3a3660"/>
        <rect x="8" y="6" width="16" height="2" fill="#3a3660"/>
        <rect x="10" y="11" width="2" height="3" fill="#50fa7b"/>
        <rect x="20" y="11" width="2" height="3" fill="#50fa7b"/>
        <rect x="15" y="15" width="2" height="2" fill="#ff79c6"/>
        <rect x="8" y="20" width="16" height="6" fill="#3a3660"/>
        <rect x="10" y="26" width="4" height="2" fill="#3a3660"/>
        <rect x="18" y="26" width="4" height="2" fill="#3a3660"/>
        <rect x="26" y="3" width="2" height="2" fill="#ffe066"/>
        <rect x="28" y="5" width="2" height="4" fill="#ffe066"/>
        <rect x="26" y="9" width="2" height="2" fill="#ffe066"/>
      </svg>
      <div class="site-label">Black Cat<br>Under The Moon</div>
    </div>

    <div class="title">🌙 靈魂配對成功 ✨</div>
    <div class="score-row">
      <div class="score-sub">同步率</div>
      <span class="score-big">${score}</span><span class="score-sep">/</span><span class="score-max">80</span>
    </div>

    <div class="users-panel">
    <div class="users-panel-border"><svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ff00ff"/><stop offset="40%" stop-color="#3d3870"/><stop offset="60%" stop-color="#3d3870"/><stop offset="100%" stop-color="#00ffff"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="none" stroke="url(#gb)" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg></div>
    <div class="users">
      <div class="user-card user-a">
        <div class="user-name">${escHtml(user.name)}</div>
        <div class="user-tag">${escHtml(user.identity)}</div>
        <div class="user-info">${user.age ? user.age + ' 歲' : ''}${user.height ? ' · ' + user.height + ' cm' : ''}</div>
        ${user.ig_username ? `<div class="user-ig"><svg viewBox="0 0 14 10" width="14" height="10" shape-rendering="crispEdges" style="image-rendering:pixelated;vertical-align:middle;margin-right:3px"><rect x="4" y="0" width="4" height="2" fill="#ffe066"/><rect x="0" y="2" width="14" height="8" fill="#ffe066"/><rect x="5" y="4" width="4" height="4" fill="#121212"/><rect x="6" y="5" width="2" height="2" fill="#ffe066"/></svg> ${escHtml(user.ig_username)}</div>` : ''}
      </div>
      <div class="heart-icon"><svg viewBox="0 0 16 14" width="28" height="24" shape-rendering="crispEdges" style="image-rendering:pixelated"><rect x="2" y="0" width="4" height="2" fill="#ff4757"/><rect x="10" y="0" width="4" height="2" fill="#ff4757"/><rect x="0" y="2" width="8" height="2" fill="#ff4757"/><rect x="8" y="2" width="8" height="2" fill="#ff4757"/><rect x="0" y="4" width="16" height="2" fill="#ff4757"/><rect x="2" y="6" width="12" height="2" fill="#ff4757"/><rect x="4" y="8" width="8" height="2" fill="#ff4757"/><rect x="6" y="10" width="4" height="2" fill="#ff4757"/></svg></div>
      <div class="user-card user-b">
        <div class="user-name">${escHtml(target.name)}</div>
        <div class="user-tag">${escHtml(target.identity)}</div>
        <div class="user-info">${target.age ? target.age + ' 歲' : ''}${target.height ? ' · ' + target.height + ' cm' : ''}</div>
        ${target.ig_username ? `<div class="user-ig"><svg viewBox="0 0 14 10" width="14" height="10" shape-rendering="crispEdges" style="image-rendering:pixelated;vertical-align:middle;margin-right:3px"><rect x="4" y="0" width="4" height="2" fill="#ffe066"/><rect x="0" y="2" width="14" height="8" fill="#ffe066"/><rect x="5" y="4" width="4" height="4" fill="#121212"/><rect x="6" y="5" width="2" height="2" fill="#ffe066"/></svg> ${escHtml(target.ig_username)}</div>` : ''}
      </div>
    </div>
    </div>
    <hr class="divider">

    <div class="radar-section">
      <div class="radar-title">配對雷達圖</div>
      ${radarSvg}
    </div>

    <div class="breakdown">
      <div class="bd-title">詳細評分</div>
      ${[
        ['🔥 火花', breakdown.bedRole],
        ['📅 步調', breakdown.social],
        ['💬 語頻', breakdown.values],
        ['💞 共鳴', breakdown.loveLang],
      ].map(([label, s]) => `
      <div class="bd-item">
        <span class="bd-label">${label}</span>
        <div class="bd-bar-wrap"><div class="bd-bar">${pixelBar(s, 20)}</div></div>
        <span class="bd-score">${s} / 20</span>
      </div>`).join('')}
    </div>

    <button class="download-btn" onclick="downloadCard()">📥 下載配對卡片</button>
    <div class="corner-bl"></div>
    <div class="corner-br"></div>
  </div>
  <script>
    function downloadCard() {
      const card = document.querySelector('.card');
      const btn = document.querySelector('.download-btn');
      btn.style.display = 'none';
      html2canvas(card, {
        backgroundColor: '#121212',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        onclone: function(doc) {
          // Ensure all pseudo-elements and overlays render
          var c = doc.querySelector('.card');
          if (c) c.style.overflow = 'hidden';
        }
      }).then(canvas => {
        btn.style.display = '';
        const link = document.createElement('a');
        link.download = 'match-card-${user.name}-${target.name}.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }).catch(() => { btn.style.display = ''; });
    }
  <\/script>
</body>
</html>`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  let userId = null;
  let generateCards = false;

  for (const arg of args) {
    if (arg.startsWith('--userId=')) userId = Number(arg.split('=')[1]);
    if (arg === '--generateCards') generateCards = true;
  }

  console.log('\n🌙 Matching Algorithm Test Suite\n');
  console.log('📊 Fetching users from Supabase...');

  const { data: allUsers, error: fetchError } = await supabase.from('responses').select('*');

  if (fetchError) {
    console.error('❌ Fetch error:', fetchError.message);
    process.exit(1);
  }
  if (!allUsers || allUsers.length === 0) {
    console.error('❌ No users found. Run: node scripts/seed-test-data.js --count=20');
    process.exit(1);
  }

  console.log(`✅ Loaded ${allUsers.length} users\n`);

  const testUser = userId ? allUsers.find((u) => u.id === userId) : allUsers[0];
  if (!testUser) {
    console.error(`❌ User ID ${userId} not found`);
    process.exit(1);
  }

  console.log(`👤 Testing matches for: ${testUser.name} (ID:${testUser.id}, ${testUser.identity})`);
  console.log(`   bed_role: ${testUser.bed_role}`);
  console.log(`   ideal_identity: ${testUser.ideal_identity}`);
  console.log(`   social_energy: ${testUser.social_energy}`);
  console.log(`   love_languages: ${testUser.love_languages}\n`);

  // Calculate matches
  const matches = [];
  for (const candidate of allUsers) {
    if (candidate.id === testUser.id) continue;
    const passesFilter = passesHardFilter(testUser, candidate);
    const { total, breakdown } = calculateMatchScore(testUser, candidate);
    matches.push({ candidateId: candidate.id, candidate, score: total, breakdown, passesFilter });
  }
  matches.sort((a, b) => b.score - a.score);

  // Top matches (filter-passing only)
  const validMatches = matches.filter((m) => m.passesFilter);
  const allRanked = matches;

  console.log(`💕 Top 10 Matches (hard filter passed: ${validMatches.length}/${matches.length}):\n`);
  matches.slice(0, 10).forEach((m, idx) => {
    const filterMark = m.passesFilter ? '✅' : '⚠️ (filter fail)';
    console.log(`  ${String(idx + 1).padStart(2)}. ${m.candidate.name} (${m.candidate.identity}) [${m.candidate.bed_role?.match(/\((\w+)\)/)?.[1] ?? '?'}]  Score: ${m.score}/80  ${filterMark}`);
    console.log(`      火花:${m.breakdown.bedRole} | 步調:${m.breakdown.social} | 語頻:${m.breakdown.values} | 共鳴:${m.breakdown.loveLang}`);
  });

  // Score distribution (all candidates)
  const bands = [
    ['70-80',  (m) => m.score >= 70],
    ['60-69',  (m) => m.score >= 60 && m.score < 70],
    ['50-59',  (m) => m.score >= 50 && m.score < 60],
    ['40-49',  (m) => m.score >= 40 && m.score < 50],
    ['30-39',  (m) => m.score >= 30 && m.score < 40],
    ['<30',    (m) => m.score < 30],
  ];

  console.log('\n📈 Score Distribution (all candidates):\n');
  for (const [label, fn] of bands) {
    const count = allRanked.filter(fn).length;
    const bar = '█'.repeat(Math.round(count));
    console.log(`  ${label.padEnd(7)} ${bar.padEnd(20)} (${count})`);
  }

  // Dimension averages
  const avg = (field) => (allRanked.reduce((s, m) => s + m.breakdown[field], 0) / (allRanked.length || 1)).toFixed(1);
  console.log('\n📊 Average dimension scores (vs all candidates):\n');
  console.log(`  火花 (互補): ${avg('bedRole')} / 20`);
  console.log(`  步調 (社交/週末): ${avg('social')} / 20`);
  console.log(`  語頻 (三觀): ${avg('values')} / 20`);
  console.log(`  共鳴 (愛語): ${avg('loveLang')} / 20`);

  // Generate cards
  if (generateCards) {
    const outDir = path.join(process.cwd(), 'match-cards');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const toGenerate = validMatches.slice(0, 3).length > 0 ? validMatches.slice(0, 3) : matches.slice(0, 3);
    console.log(`\n📄 Generating ${toGenerate.length} match card(s)...\n`);

    for (const match of toGenerate) {
      const html = buildMatchCardHtml({
        user: testUser,
        target: match.candidate,
        score: match.score,
        breakdown: match.breakdown,
      });
      const filename = `match_${testUser.id}_${match.candidateId}_${Date.now()}.html`;
      const filepath = path.join(outDir, filename);
      fs.writeFileSync(filepath, html);
      console.log(`  ✅ ${filename}`);
    }
    console.log(`\n  Open files in match-cards/ directory`);
  }

  console.log(`\n💡 Commands:`);
  console.log(`  node scripts/test-matching.js --userId=${testUser.id} --generateCards`);
  console.log(`  node scripts/seed-test-data.js --count=30 --clear\n`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
