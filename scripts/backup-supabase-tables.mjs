#!/usr/bin/env node
/**
 * Backup critical Supabase tables to local CSV files (Supabase table export format).
 *
 * Tables: profiles, responses, sent_matches, subscriptions
 *
 * Usage:
 *   node scripts/backup-supabase-tables.mjs
 *   node scripts/backup-supabase-tables.mjs --keep=14
 *   node scripts/backup-supabase-tables.mjs --out=backups
 *   node scripts/backup-supabase-tables.mjs --format=both   # csv + json
 *
 * Requires in .env.local (or env):
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Windows Task Scheduler (weekly example):
 *   Program: powershell.exe
 *   Args: -NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\path\to\BlackCatUnderTheMoon'; npm run backup:supabase"
 */

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, readdir, rm, stat } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TABLES = ['profiles', 'responses', 'sent_matches', 'subscriptions'];
const PAGE_SIZE = 1000;

function loadEnvFile() {
  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx);
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const opts = {
    out: 'backups',
    keep: 30,
    format: 'csv',
  };
  for (const arg of argv) {
    if (arg.startsWith('--out=')) opts.out = arg.slice(6);
    else if (arg.startsWith('--keep=')) opts.keep = Math.max(1, Number(arg.slice(7)) || 30);
    else if (arg.startsWith('--format=')) {
      const fmt = arg.slice(9);
      if (fmt === 'csv' || fmt === 'json' || fmt === 'both') opts.format = fmt;
    }
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeCsvCell(value) {
  if (value == null) return '';
  let text;
  if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Column order follows first row keys (same order as Supabase API), then any extra columns. */
function collectColumns(rows) {
  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return columns;
}

function rowsToCsv(rows) {
  if (!rows.length) return '\uFEFF';
  const columns = collectColumns(rows);
  const lines = [columns.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCsvCell(row[col])).join(','));
  }
  // UTF-8 BOM helps Excel open Chinese text correctly on Windows.
  return `\uFEFF${lines.join('\r\n')}`;
}

async function fetchTableRows(supabase, table) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function pruneOldBackups(baseDir, keep) {
  if (!existsSync(baseDir)) return;

  const entries = await readdir(baseDir, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('supabase-')) continue;
    const full = join(baseDir, entry.name);
    const info = await stat(full);
    dirs.push({ name: entry.name, full, mtime: info.mtimeMs });
  }

  dirs.sort((a, b) => b.mtime - a.mtime);
  const toDelete = dirs.slice(keep);
  for (const dir of toDelete) {
    await rm(dir.full, { recursive: true, force: true });
    console.log(`🗑️  Removed old backup: ${dir.name}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Usage: node scripts/backup-supabase-tables.mjs [--out=backups] [--keep=30] [--format=csv|json|both]');
    process.exit(0);
  }

  loadEnvFile();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const backupDir = resolve(ROOT, opts.out, `supabase-${stamp()}`);
  await mkdir(backupDir, { recursive: true });

  const writeCsv = opts.format === 'csv' || opts.format === 'both';
  const writeJson = opts.format === 'json' || opts.format === 'both';

  const manifest = {
    created_at: new Date().toISOString(),
    supabase_url: supabaseUrl,
    format: opts.format,
    tables: {},
  };

  console.log(`📦 Backup → ${backupDir} (${opts.format})`);

  for (const table of TABLES) {
    process.stdout.write(`   ${table}… `);
    const rows = await fetchTableRows(supabase, table);
    const files = [];

    if (writeCsv) {
      const csvPath = join(backupDir, `${table}.csv`);
      await writeFile(csvPath, rowsToCsv(rows), 'utf8');
      files.push(`${table}.csv`);
    }

    if (writeJson) {
      const jsonPath = join(backupDir, `${table}.json`);
      await writeFile(jsonPath, JSON.stringify(rows, null, 2), 'utf8');
      files.push(`${table}.json`);
    }

    manifest.tables[table] = {
      count: rows.length,
      columns: collectColumns(rows),
      files,
    };
    console.log(`${rows.length} rows → ${files.join(', ')}`);
  }

  await writeFile(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await pruneOldBackups(resolve(ROOT, opts.out), opts.keep);

  console.log('✅ Backup complete');
}

main().catch((err) => {
  console.error('❌ Backup failed:', err.message || err);
  process.exit(1);
});
