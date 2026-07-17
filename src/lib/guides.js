/**
 * File-based SEO guides/articles loader.
 * Reads Markdown files from src/content/guides/*.md at build time.
 * Frontmatter is parsed with a small in-repo parser (no extra dependency).
 *
 * Frontmatter fields: title, description, slug, date, updated, keywords, excerpt, cover.
 */

import fs from 'fs';
import path from 'path';

const GUIDES_DIR = path.join(process.cwd(), 'src', 'content', 'guides');

/** Minimal YAML-frontmatter parser (supports strings, quoted strings and inline [a, b] arrays). */
function parseFrontmatter(raw) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, content: raw };

  const [, block, content] = match;
  const data = {};
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, content: content || '' };
}

function readGuideFile(fileName) {
  const slug = fileName.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(GUIDES_DIR, fileName), 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    slug: data.slug || slug,
    title: data.title || slug,
    description: data.description || '',
    excerpt: data.excerpt || data.description || '',
    date: data.date || null,
    updated: data.updated || data.date || null,
    keywords: Array.isArray(data.keywords)
      ? data.keywords
      : (data.keywords ? String(data.keywords).split(',').map((s) => s.trim()) : []),
    cover: data.cover || null,
    content,
  };
}

/** All guides, newest first. */
export function getAllGuides() {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(readGuideFile)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/** Slugs only, for getStaticPaths. */
export function getAllGuideSlugs() {
  return getAllGuides().map((g) => g.slug);
}

/** Single guide by slug, or null. */
export function getGuideBySlug(slug) {
  return getAllGuides().find((g) => g.slug === slug) || null;
}
