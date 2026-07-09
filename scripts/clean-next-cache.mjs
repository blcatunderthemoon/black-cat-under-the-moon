#!/usr/bin/env node
/**
 * Remove local Next.js build caches (OneDrive-safe dev reset).
 */
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');

const targets = [
  join(root, '.next'),
  join(root, 'node_modules', '.cache', 'next'),
  join(localAppData, 'blackcat-under-the-moon-next'),
  join(tmpdir(), 'blackcat-under-the-moon-next'),
];

for (const target of targets) {
  if (!existsSync(target)) continue;
  await rm(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
}

console.log('Next.js cache cleared.');
