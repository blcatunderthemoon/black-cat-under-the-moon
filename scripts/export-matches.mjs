#!/usr/bin/env node
/**
 * Match Results Excel Export — Black Cat Under The Moon
 * Generates an .xlsx file with one sheet per user.
 * Each sheet: Row 1 = headers, Row 2 = main user data (yellow),
 * then matched users (score ≥ threshold) sorted by score desc.
 *
 * Usage: node scripts/export-matches.mjs [--threshold=60]
 */

import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// Config
// ============================================================
const DEFAULT_THRESHOLD = 60;

// ============================================================
// Env + Supabase setup (same as test-matching.mjs)
// ============================================================
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
} catch { /* .env.local not found */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

// ============================================================
// Matching algorithm (copied from test-matching.mjs)
// ============================================================

function parseCSV(str) {
  if (!str) return new Set();
  return new Set(str.split(',').map(s => s.trim()).filter(Boolean));
}

function parseRange(raw) {
  if (raw == null) return null;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length === 2) return { min: Number(arr[0]), max: Number(arr[1]) };
  } catch { /* ignore */ }
  return null;
}

function getBedRole(str) {
  if (!str) return 'unknown';
  if (str.includes('Top')) return 'Top';
  if (str.includes('Bottom')) return 'Bottom';
  if (str.includes('Switch')) return 'Switch';
  return 'neutral';
}

function passesIdentityFilter(user, candidate) {
  const userIdeal = parseCSV(user.ideal_identity);
  const candidateIdeal = parseCSV(candidate.ideal_identity);
  return (userIdeal.has('冇所謂') || userIdeal.has(candidate.identity))
      && (candidateIdeal.has('冇所謂') || candidateIdeal.has(user.identity));
}

function passesBodyTypeFilter(user, candidate) {
  const userPref = parseCSV(user.ideal_appearance);
  const candidatePref = parseCSV(candidate.ideal_appearance);
  return (userPref.size === 0 || userPref.has('冇所謂') || userPref.has(candidate.body_type))
      && (candidatePref.size === 0 || candidatePref.has('冇所謂') || candidatePref.has(user.body_type));
}

function passesHeightFilter(user, candidate) {
  if (user.height == null || candidate.height == null) return true;
  const cRange = parseRange(candidate.ideal_height_gap);
  if (cRange != null) { const d = user.height - candidate.height; if (d < cRange.min || d > cRange.max) return false; }
  const uRange = parseRange(user.ideal_height_gap);
  if (uRange != null) { const d = candidate.height - user.height; if (d < uRange.min || d > uRange.max) return false; }
  return true;
}

function passesAgeFilter(user, candidate) {
  if (user.age == null || candidate.age == null) return true;
  const cRange = parseRange(candidate.ideal_age_gap);
  if (cRange != null) { const d = user.age - candidate.age; if (d < cRange.min || d > cRange.max) return false; }
  const uRange = parseRange(user.ideal_age_gap);
  if (uRange != null) { const d = candidate.age - user.age; if (d < uRange.min || d > uRange.max) return false; }
  return true;
}

function passesHardFilter(user, candidate) {
  return passesIdentityFilter(user, candidate)
    && passesBodyTypeFilter(user, candidate)
    && passesHeightFilter(user, candidate)
    && passesAgeFilter(user, candidate);
}

function scoreBedRole(userRole, candidateRole) {
  const u = getBedRole(userRole), c = getBedRole(candidateRole);
  if ((u === 'Top' && c === 'Bottom') || (u === 'Bottom' && c === 'Top')) return 20;
  if (u === 'Switch' || c === 'Switch') return 15;
  if (u === c) return 5;
  return 10;
}

function scoreLoveLanguage(userLL, candidateLL) {
  const uSet = parseCSV(userLL), cSet = parseCSV(candidateLL);
  let overlap = 0;
  for (const item of uSet) { if (cSet.has(item)) overlap++; }
  return Math.min(overlap * 10, 20);
}

function scoreSocialWeekend(user, candidate) {
  let s = 0;
  if (user.social_energy && user.social_energy === candidate.social_energy) s += 10;
  if (user.weekend_mode && user.weekend_mode === candidate.weekend_mode) s += 10;
  return s;
}

function scoreValues(user, candidate) {
  let s = 0;
  if (user.communication_style && user.communication_style === candidate.communication_style) s += 8;
  if (user.expense_splitting && user.expense_splitting === candidate.expense_splitting) s += 6;
  if (user.living_together && user.living_together === candidate.living_together) s += 6;
  return s;
}

function calculateMatchScore(user, candidate) {
  const bedRole = scoreBedRole(user.bed_role, candidate.bed_role);
  const loveLang = scoreLoveLanguage(user.love_languages, candidate.love_languages);
  const social = scoreSocialWeekend(user, candidate);
  const values = scoreValues(user, candidate);
  return { total: bedRole + loveLang + social + values, breakdown: { bedRole, loveLang, social, values } };
}

// ============================================================
// Column definitions
// ============================================================

const COLUMNS = [
  { key: '_score',              header: '配對分數', width: 10 },
  { key: '_bedRole',            header: '火花分', width: 8 },
  { key: '_loveLang',           header: '共鳴分', width: 8 },
  { key: '_social',             header: '步調分', width: 8 },
  { key: '_values',             header: '語頻分', width: 8 },
  { key: 'id',                  header: 'ID', width: 6 },
  { key: 'name',                header: '名稱', width: 14 },
  { key: 'age',                 header: '年齡', width: 6 },
  { key: 'height',              header: '身高', width: 6 },
  { key: 'identity',            header: '身份認同', width: 10 },
  { key: 'body_type',           header: '體型', width: 12 },
  { key: 'hair_style',          header: '髮型', width: 12 },
  { key: 'fashion_styles',      header: '穿搭風格', width: 20 },
  { key: 'bed_role',            header: '床上角色', width: 30 },
  { key: 'social_energy',       header: '社交能量', width: 18 },
  { key: 'weekend_mode',        header: '週末模式', width: 25 },
  { key: 'interests',           header: '興趣', width: 30 },
  { key: 'exercise_habits',     header: '運動習慣', width: 20 },
  { key: 'travel_mode',         header: '旅行模式', width: 20 },
  { key: 'relationship_goal',   header: '關係目標', width: 30 },
  { key: 'time_commitment',     header: '時間投入', width: 20 },
  { key: 'deal_breakers',       header: '底線', width: 30 },
  { key: 'love_languages',      header: '愛的語言', width: 35 },
  { key: 'security_needs',      header: '安全感需求', width: 30 },
  { key: 'daily_love_ritual',   header: '日常愛的儀式', width: 30 },
  { key: 'decision_making',     header: '決策方式', width: 25 },
  { key: 'communication_style', header: '溝通風格', width: 30 },
  { key: 'expense_splitting',   header: '費用分攤', width: 25 },
  { key: 'living_together',     header: '同居意願', width: 25 },
  { key: 'ideal_identity',      header: '理想身份', width: 18 },
  { key: 'ideal_body_type',     header: '理想體型', width: 18 },
  { key: 'ideal_height_gap',    header: '理想身高差', width: 14 },
  { key: 'ideal_age_gap',       header: '理想年齡差', width: 14 },
  { key: 'gap_moe',             header: '反差萌', width: 30 },
  { key: 'preferred_attribute', header: '偏好特質', width: 14 },
  { key: 'ideal_appearance',    header: '理想外貌', width: 18 },
  { key: 'personal_traits',     header: '個人特質', width: 25 },
  { key: 'ig_username',         header: 'IG', width: 16 },
  { key: 'email',               header: 'Email', width: 24 },
];

// ============================================================
// Excel helpers
// ============================================================

const FILL_YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const FILL_GREEN  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5F5E3' } };
const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D2B55' } };
const FONT_HEADER = { bold: true, color: { argb: 'FFFFFFFE' }, size: 10 };
const FONT_NORMAL = { size: 10 };
const BORDER_THIN = {
  top: { style: 'thin', color: { argb: 'FFD5D5D5' } },
  bottom: { style: 'thin', color: { argb: 'FFD5D5D5' } },
  left: { style: 'thin', color: { argb: 'FFD5D5D5' } },
  right: { style: 'thin', color: { argb: 'FFD5D5D5' } },
};

function cellValue(user, key) {
  const v = user[key];
  if (v == null) return '';
  if (typeof v === 'string' && v.startsWith('[')) {
    try { return JSON.parse(v).join(', '); } catch { /* ignore */ }
  }
  return v;
}

function userRow(user, scoreInfo) {
  return COLUMNS.map(col => {
    if (col.key === '_score') return scoreInfo ? scoreInfo.total : '';
    if (col.key === '_bedRole') return scoreInfo ? scoreInfo.breakdown.bedRole : '';
    if (col.key === '_loveLang') return scoreInfo ? scoreInfo.breakdown.loveLang : '';
    if (col.key === '_social') return scoreInfo ? scoreInfo.breakdown.social : '';
    if (col.key === '_values') return scoreInfo ? scoreInfo.breakdown.values : '';
    return cellValue(user, col.key);
  });
}

function sanitizeSheetName(name, id) {
  // Excel sheet name max 31 chars, no special chars: \ / * ? : [ ]
  let raw = `${name} (${id})`;
  raw = raw.replace(/[\\/*?:\[\]]/g, '_');
  return raw.slice(0, 31);
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  let threshold = DEFAULT_THRESHOLD;

  for (const arg of args) {
    if (arg.startsWith('--threshold=')) threshold = Number(arg.split('=')[1]);
  }

  console.log('\n🌙 Black Cat — Match Results Excel Export\n');
  console.log(`📊 Threshold: ≥ ${threshold}/80\n`);

  // Fetch all users
  console.log('📥 Fetching users from Supabase...');
  const { data: allUsers, error } = await supabase.from('responses').select('*');
  if (error) { console.error('❌ Fetch error:', error.message); process.exit(1); }
  console.log(`   Found ${allUsers.length} users\n`);

  // Create workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Black Cat Under The Moon';
  wb.created = new Date();

  let totalSheets = 0;
  let totalMatches = 0;

  for (const user of allUsers) {
    // Find matches for this user
    const matches = [];
    for (const candidate of allUsers) {
      if (candidate.id === user.id) continue;
      if (!passesHardFilter(user, candidate)) continue;
      const result = calculateMatchScore(user, candidate);
      if (result.total >= threshold) {
        matches.push({ user: candidate, ...result });
      }
    }
    matches.sort((a, b) => b.total - a.total);

    // Create sheet
    const sheetName = sanitizeSheetName(user.name || 'Unknown', user.id);
    const ws = wb.addWorksheet(sheetName);

    // Set column widths
    ws.columns = COLUMNS.map(col => ({ width: col.width }));

    // Row 1: "用戶資料" section label
    const labelRow = ws.addRow([`👤 用戶：${user.name || 'Unknown'}（ID: ${user.id}）`]);
    labelRow.font = { bold: true, size: 12, color: { argb: 'FF2D2B55' } };
    ws.mergeCells(1, 1, 1, COLUMNS.length);

    // Row 2: Headers
    const headerRow = ws.addRow(COLUMNS.map(c => c.header));
    headerRow.eachCell(cell => {
      cell.fill = FILL_HEADER;
      cell.font = FONT_HEADER;
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    // Row 3: Main user data (yellow highlight, no score columns)
    const mainRow = ws.addRow(userRow(user, null));
    mainRow.eachCell(cell => {
      cell.fill = FILL_YELLOW;
      cell.font = { ...FONT_NORMAL, bold: true };
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    // Row 4: empty separator
    ws.addRow([]);

    // Row 5: Matches section label
    const matchLabel = ws.addRow([`💘 配對結果（≥ ${threshold} 分）— 共 ${matches.length} 人`]);
    matchLabel.font = { bold: true, size: 11, color: { argb: 'FF8B0000' } };
    ws.mergeCells(5, 1, 5, COLUMNS.length);

    // Row 6: Headers again for matches
    const matchHeaderRow = ws.addRow(COLUMNS.map(c => c.header));
    matchHeaderRow.eachCell(cell => {
      cell.fill = FILL_HEADER;
      cell.font = FONT_HEADER;
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    // Row 7+: Matched users
    for (const match of matches) {
      const row = ws.addRow(userRow(match.user, match));
      const isHighScore = match.total >= 70;
      row.eachCell(cell => {
        if (isHighScore) cell.fill = FILL_GREEN;
        cell.font = FONT_NORMAL;
        cell.border = BORDER_THIN;
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    }

    // Freeze panes: freeze header rows
    ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 0 }];

    totalSheets++;
    totalMatches += matches.length;

    // Progress
    if (totalSheets % 10 === 0) console.log(`   Processed ${totalSheets}/${allUsers.length} users...`);
  }

  // Write file
  const outDir = resolve(__dirname, '../match-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Hong_Kong' }).replace(' ', 'T').replace(/[:.]/g, '-');
  const outPath = join(outDir, `matches-${timestamp}.xlsx`);

  await wb.xlsx.writeFile(outPath);

  console.log(`\n✅ Excel exported successfully!`);
  console.log(`   📁 ${outPath}`);
  console.log(`   📊 ${totalSheets} sheets, ${totalMatches} total matches (threshold ≥ ${threshold})`);
  console.log();
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
