#!/usr/bin/env node
/**
 * Full Supabase public-schema backup → restore-ready SQL + JSON (+ optional CSV).
 *
 * SAFETY — READ-ONLY against Supabase:
 *   - Only HTTP GET (OpenAPI) and PostgREST SELECT are used.
 *   - Never insert / update / upsert / delete / rpc / storage uploads.
 *   - Local disk only: writes new backup folders; may delete *old local*
 *     backup folders under --out (retention). Never touches remote DB rows.
 *
 * Discovers all PostgREST-exposed tables, exports every row, keeps only the
 * last N calendar days of backup folders (default 3).
 *
 * Usage:
 *   node scripts/backup-supabase-tables.mjs
 *   node scripts/backup-supabase-tables.mjs --keep-days=3
 *   node scripts/backup-supabase-tables.mjs --format=sql,json,csv
 *   node scripts/backup-supabase-tables.mjs --out=D:\Backups\blackcat
 *   node scripts/backup-supabase-tables.mjs --tables=profiles,responses
 *
 * Requires .env.local:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, readdir, rm, stat } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PAGE_SIZE = 1000;

/** Fallback if OpenAPI discovery fails (keep in sync with production schema). */
const FALLBACK_TABLES = [
  'profiles',
  'responses',
  'sent_matches',
  'subscriptions',
  'email_drafts',
  'contact_feedback',
  'mirror_cards',
  'mirror_card_reports',
  'inbox_threads',
  'inbox_messages',
  'inbox_blocks',
  'letter_stamps',
  'photo_exchanges',
  'forum_posts',
  'forum_comments',
  'forum_likes',
  'forum_comment_likes',
  'forum_bookmarks',
  'forum_reports',
  'forum_moderation_log',
  'forum_moderator_assignments',
  'forum_polls',
  'forum_poll_votes',
  'forum_mention_notifications',
  'forum_post_tags',
  'forum_tag_labels',
  'forum_banner',
  'forum_welcome_posts',
  'forum_story_chapters',
  'forum_hit_topics',
  'moon_journey_events',
  'moon_journey_daily_counts',
  'legacy_match_claims',
  'bottles',
  'bottle_replies',
  'bottle_likes',
  'bottle_reports',
  'topic_banner',
  'user_cats',
  'user_cat_room',
  'cat_care_events',
  'cat_economy_events',
  'gatherings',
  'gathering_attendees',
  'gathering_comments',
  'gathering_reports',
  'site_presence',
];

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
    out: process.env.BACKUP_OUT || 'backups',
    keepDays: 3,
    format: 'sql,json',
    tables: null,
    help: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--out=')) opts.out = arg.slice(6);
    else if (arg.startsWith('--keep-days=')) {
      opts.keepDays = Math.max(1, Number(arg.slice(12)) || 3);
    }
    else if (arg.startsWith('--keep=')) {
      // Legacy: treat as keep-days for convenience
      opts.keepDays = Math.max(1, Number(arg.slice(7)) || 3);
    }
    else if (arg.startsWith('--format=')) {
      opts.format = arg.slice(9);
    }
    else if (arg.startsWith('--tables=')) {
      opts.tables = arg.slice(9).split(',').map((t) => t.trim()).filter(Boolean);
    }
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

function parseFormats(raw) {
  const parts = String(raw || 'sql,json')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set(parts);
  if (set.has('both')) {
    set.add('csv');
    set.add('json');
  }
  if (set.has('all')) {
    set.add('sql');
    set.add('json');
    set.add('csv');
  }
  return {
    sql: set.has('sql'),
    json: set.has('json'),
    csv: set.has('csv'),
  };
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function dayKeyFromBackupName(name) {
  // supabase-YYYY-MM-DD_HHMMSS
  const m = /^supabase-(\d{4}-\d{2}-\d{2})_/.exec(name);
  return m ? m[1] : null;
}

function localDayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escapeCsvCell(value) {
  if (value == null) return '';
  let text;
  if (typeof value === 'object') text = JSON.stringify(value);
  else text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

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
  return `\uFEFF${lines.join('\r\n')}`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  const text = String(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${text}'`;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function rowsToSql(table, rows) {
  const lines = [
    `-- Black Cat Under The Moon backup`,
    `-- table: public.${table}`,
    `-- rows: ${rows.length}`,
    `-- generated: ${new Date().toISOString()}`,
    `--`,
    `-- Restore tip: run migrations first on an empty project, then execute this file`,
    `-- in Supabase SQL Editor (or psql). Prefer ON CONFLICT upsert when a PK exists.`,
    ``,
  ];

  if (!rows.length) {
    lines.push(`-- (empty table)`);
    lines.push('');
    return lines.join('\n');
  }

  const columns = collectColumns(rows);
  const colList = columns.map(quoteIdent).join(', ');
  const chunkSize = 100;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map((row) => {
      const cells = columns.map((col) => sqlLiteral(row[col]));
      return `(${cells.join(', ')})`;
    });
    lines.push(`INSERT INTO public.${quoteIdent(table)} (${colList})`);
    lines.push(`VALUES`);
    lines.push(`${values.join(',\n')}`);
    // Prefer upsert when id exists; otherwise plain insert.
    if (columns.includes('id')) {
      lines.push(`ON CONFLICT (id) DO UPDATE SET`);
      const updates = columns
        .filter((c) => c !== 'id')
        .map((c) => `  ${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`);
      if (updates.length) {
        lines.push(`${updates.join(',\n')};`);
      } else {
        lines.push(`  ${quoteIdent('id')} = EXCLUDED.${quoteIdent('id')};`);
      }
    } else {
      lines.push(';');
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function discoverTables(supabaseUrl, serviceKey) {
  // GET only — OpenAPI schema discovery (no DB mutation).
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/openapi+json',
    },
  });
  if (!res.ok) {
    throw new Error(`OpenAPI discovery failed: HTTP ${res.status}`);
  }
  const spec = await res.json();
  const paths = Object.keys(spec.paths || {});
  const tables = paths
    .filter((p) => /^\/[A-Za-z_][A-Za-z0-9_]*$/.test(p))
    .map((p) => p.slice(1))
    .filter((name) => !name.startsWith('rpc/'))
    .sort((a, b) => a.localeCompare(b));
  if (!tables.length) throw new Error('OpenAPI returned no tables');
  return tables;
}

/**
 * Read-only Supabase client: only `.from(table).select(...)` is exposed.
 * Blocks insert/update/upsert/delete/rpc so backup cannot mutate data by mistake.
 */
function createReadOnlySupabase(supabaseUrl, serviceKey) {
  const raw = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    from(table) {
      const builder = raw.from(table);
      return {
        select(columns = '*') {
          let q = builder.select(columns);
          const api = {
            order(column, opts) {
              q = q.order(column, opts);
              return api;
            },
            range(from, to) {
              q = q.range(from, to);
              return api;
            },
            then(onFulfilled, onRejected) {
              return Promise.resolve(q).then(onFulfilled, onRejected);
            },
          };
          return api;
        },
        insert() {
          throw new Error('READ-ONLY backup: insert() is not allowed');
        },
        update() {
          throw new Error('READ-ONLY backup: update() is not allowed');
        },
        upsert() {
          throw new Error('READ-ONLY backup: upsert() is not allowed');
        },
        delete() {
          throw new Error('READ-ONLY backup: delete() is not allowed');
        },
      };
    },
    rpc() {
      throw new Error('READ-ONLY backup: rpc() is not allowed');
    },
  };
}

async function fetchTableRows(supabase, table) {
  const orderCandidates = ['id', 'created_at', 'updated_at'];
  let orderCol = null;
  let lastError = null;

  for (const col of orderCandidates) {
    const probe = await supabase
      .from(table)
      .select('*')
      .order(col, { ascending: true })
      .range(0, 0);
    if (!probe.error) {
      orderCol = col;
      break;
    }
    lastError = probe.error;
  }

  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (orderCol) query = query.order(orderCol, { ascending: true });
    const { data, error } = await query;
    if (error) {
      // Table may be a view without selectable rows / RLS edge case
      throw new Error(error.message || lastError?.message || 'query failed');
    }
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows, orderCol };
}

async function pruneOldBackups(baseDir, keepDays) {
  if (!existsSync(baseDir)) return { removed: [], kept: [] };

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (keepDays - 1));
  const cutoffKey = localDayKey(cutoff);

  const entries = await readdir(baseDir, { withFileTypes: true });
  const removed = [];
  const kept = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('supabase-')) continue;
    const full = join(baseDir, entry.name);
    const day = dayKeyFromBackupName(entry.name);
    let shouldKeep = false;
    if (day) {
      shouldKeep = day >= cutoffKey;
    } else {
      const info = await stat(full);
      shouldKeep = info.mtimeMs >= cutoff.getTime();
    }
    if (shouldKeep) {
      kept.push(entry.name);
    } else {
      await rm(full, { recursive: true, force: true });
      removed.push(entry.name);
      console.log(`🗑️  Removed old backup (>${keepDays} days): ${entry.name}`);
    }
  }

  return { removed, kept };
}

function buildRestoreReadme({ createdAt, tables, formats, keepDays, backupFolderName }) {
  return `# Restore this backup / 還原此備份

Created: ${createdAt}
Retention policy at backup time: keep last ${keepDays} calendar days

## Recommended disaster recovery / 災難復原建議

### 中文
1. 建立新的 Supabase 專案（或清空的資料庫）。
2. 依時間順序執行 \`supabase/migrations/\` 內全部 SQL。
3. 還原資料（二選一）：
   - **SQL：** 開啟 Supabase → SQL Editor，依序執行 \`sql/\` 內各檔（有 \`id\` 的表會用 \`ON CONFLICT DO UPDATE\`）。
   - **JSON 腳本：** 在專案根目錄執行  
     \`npm run restore:supabase -- --dir=backups/${backupFolderName}\`

### English
1. Create a new Supabase project (or empty DB).
2. Run all SQL in \`supabase/migrations/\` (oldest → newest).
3. Restore **data** using either:
   - **SQL files** in \`sql/\` — Supabase SQL Editor (tables with \`id\` use upsert).
   - **OR** JSON restore script:  
     \`npm run restore:supabase -- --dir=backups/${backupFolderName}\`

## Formats in this folder / 本資料夾格式

${formats.sql ? '- `sql/<table>.sql` — PostgreSQL INSERT upserts (best for Supabase SQL Editor)\n' : ''}${formats.json ? '- `json/<table>.json` — row arrays (used by `npm run restore:supabase`)\n' : ''}${formats.csv ? '- `csv/<table>.csv` — Excel-friendly UTF-8 BOM\n' : ''}- \`manifest.json\` — table list, row counts, columns

## Notes / 注意

- Auth users (\`auth.users\`) are **not** included. / **不含** Auth 用戶。
- Storage buckets / files are **not** included. / **不含** Storage 檔案。
- If FK errors occur, re-run SQL after parent tables load. / 若外鍵錯誤，父表載入後再重跑。
- Tables (${Object.keys(tables).length}): ${Object.keys(tables).sort().join(', ')}
`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/backup-supabase-tables.mjs [options]

Options:
  --out=DIR           Output root (default: backups or BACKUP_OUT)
  --keep-days=N       Keep backups from last N calendar days (default: 3)
  --format=LIST       Comma list: sql,json,csv,all (default: sql,json)
  --tables=a,b,c      Backup only these tables
  -h, --help          Show help

This command is READ-ONLY against Supabase (SELECT / OpenAPI only).
`);
    process.exit(0);
  }

  loadEnvFile();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const formats = parseFormats(opts.format);
  if (!formats.sql && !formats.json && !formats.csv) {
    console.error('❌ --format must include at least one of: sql, json, csv');
    process.exit(1);
  }

  let tableNames = opts.tables;
  let discovery = 'manual';
  if (!tableNames) {
    try {
      tableNames = await discoverTables(supabaseUrl, serviceKey);
      discovery = 'openapi';
      console.log(`🔎 Discovered ${tableNames.length} tables via PostgREST OpenAPI`);
    } catch (err) {
      console.warn(`⚠️  Table discovery failed (${err.message}); using fallback list`);
      tableNames = [...FALLBACK_TABLES];
      discovery = 'fallback';
    }
  }

  const supabase = createReadOnlySupabase(supabaseUrl, serviceKey);

  const baseOut = resolve(ROOT, opts.out);
  const folderName = `supabase-${stamp()}`;
  const backupDir = join(baseOut, folderName);
  await mkdir(backupDir, { recursive: true });
  if (formats.sql) await mkdir(join(backupDir, 'sql'), { recursive: true });
  if (formats.json) await mkdir(join(backupDir, 'json'), { recursive: true });
  if (formats.csv) await mkdir(join(backupDir, 'csv'), { recursive: true });

  const manifest = {
    created_at: new Date().toISOString(),
    supabase_url: supabaseUrl,
    mode: 'read_only',
    safety: {
      mutates_supabase: false,
      operations: ['GET /rest/v1/ (OpenAPI)', 'SELECT * FROM <table>'],
      local_only_writes: true,
      local_retention_deletes_old_backup_folders: true,
    },
    discovery,
    keep_days: opts.keepDays,
    format: opts.format,
    formats,
    restore: {
      sql_folder: formats.sql ? 'sql/' : null,
      json_folder: formats.json ? 'json/' : null,
      csv_folder: formats.csv ? 'csv/' : null,
      npm_restore: 'npm run restore:supabase -- --dir=<this-folder>',
      note: 'Restore is a separate command and DOES write to Supabase; backup never does.',
    },
    tables: {},
    errors: {},
  };

  console.log(`📦 Backup → ${backupDir}`);
  console.log('   safety: READ-ONLY against Supabase (SELECT / OpenAPI only; no remote writes)');
  console.log(`   formats: ${Object.entries(formats).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
  console.log(`   retention: last ${opts.keepDays} calendar day(s) (local folders only)`);

  let okCount = 0;
  let failCount = 0;

  for (const table of tableNames) {
    process.stdout.write(`   ${table}… `);
    try {
      const { rows, orderCol } = await fetchTableRows(supabase, table);
      const files = [];
      const columns = collectColumns(rows);
      let sha256Json = null;

      if (formats.sql) {
        const rel = join('sql', `${table}.sql`);
        await writeFile(join(backupDir, rel), rowsToSql(table, rows), 'utf8');
        files.push(rel.replace(/\\/g, '/'));
      }
      if (formats.json) {
        const rel = join('json', `${table}.json`);
        const jsonBody = `${JSON.stringify(rows, null, 2)}\n`;
        await writeFile(join(backupDir, rel), jsonBody, 'utf8');
        files.push(rel.replace(/\\/g, '/'));
        sha256Json = createHash('sha256').update(jsonBody, 'utf8').digest('hex');
      }
      if (formats.csv) {
        const rel = join('csv', `${table}.csv`);
        await writeFile(join(backupDir, rel), rowsToCsv(rows), 'utf8');
        files.push(rel.replace(/\\/g, '/'));
      }

      manifest.tables[table] = {
        count: rows.length,
        columns,
        order_by: orderCol,
        files,
        ...(sha256Json ? { sha256_json: sha256Json } : {}),
      };
      okCount += 1;
      console.log(`${rows.length} rows`);
    } catch (err) {
      failCount += 1;
      manifest.errors[table] = String(err.message || err);
      console.log(`FAILED (${err.message || err})`);
    }
  }

  await writeFile(join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(
    join(backupDir, 'RESTORE.md'),
    buildRestoreReadme({
      createdAt: manifest.created_at,
      tables: manifest.tables,
      formats,
      keepDays: opts.keepDays,
      backupFolderName: folderName,
    }),
    'utf8',
  );

  const prune = await pruneOldBackups(baseOut, opts.keepDays);

  console.log(`✅ Backup complete — ${okCount} tables ok, ${failCount} failed`);
  console.log(`   kept folders (≤${opts.keepDays}d): ${prune.kept.length}; removed: ${prune.removed.length}`);
  if (failCount) {
    console.log('   See manifest.json → errors for failed tables');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error('❌ Backup failed:', err.message || err);
  process.exit(1);
});
