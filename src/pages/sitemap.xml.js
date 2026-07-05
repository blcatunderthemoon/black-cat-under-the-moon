import { getAdminClient } from '../lib/server-auth.js';
import { getHongKongDateString } from '../lib/hong-kong-time.js';
import {
  STATIC_SITEMAP_PATHS,
  absoluteUrl,
  formatSitemapDate,
} from '../lib/site-seo.js';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  let xml = `<url><loc>${escapeXml(loc)}</loc>`;
  if (lastmod) xml += `<lastmod>${lastmod}</lastmod>`;
  if (changefreq) xml += `<changefreq>${changefreq}</changefreq>`;
  if (priority) xml += `<priority>${priority}</priority>`;
  xml += '</url>';
  return xml;
}

async function loadDynamicUrls() {
  const entries = [];
  try {
    const admin = getAdminClient();
    const [{ data: posts }, { data: cards }] = await Promise.all([
      admin
        .from('forum_posts')
        .select('id, updated_at, visibility')
        .neq('visibility', 'members_only')
        .order('updated_at', { ascending: false })
        .limit(300),
      admin
        .from('mirror_cards')
        .select('public_slug, updated_at')
        .not('public_slug', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(300),
    ]);

    (posts || []).forEach((post) => {
      if (!post?.id) return;
      entries.push({
        loc: absoluteUrl(`/forum/${post.id}`),
        lastmod: formatSitemapDate(post.updated_at),
        changefreq: 'weekly',
        priority: '0.6',
      });
    });

    (cards || []).forEach((card) => {
      if (!card?.public_slug) return;
      entries.push({
        loc: absoluteUrl(`/mirror-card/${card.public_slug}`),
        lastmod: formatSitemapDate(card.updated_at),
        changefreq: 'monthly',
        priority: '0.5',
      });
    });
  } catch {
    // Static routes still publish if DB is unavailable.
  }
  return entries;
}

function SitemapPage() {
  return null;
}

export async function getServerSideProps({ res }) {
  const today = getHongKongDateString();
  const staticEntries = STATIC_SITEMAP_PATHS.map(({ path, changefreq, priority }) => ({
    loc: absoluteUrl(path),
    lastmod: today,
    changefreq,
    priority,
  }));

  const dynamicEntries = await loadDynamicUrls();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...staticEntries, ...dynamicEntries].map(urlEntry),
    '</urlset>',
  ].join('');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(xml);
  res.end();
  return { props: {} };
}

export default SitemapPage;
