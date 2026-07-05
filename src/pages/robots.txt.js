import { getSiteUrl } from '../lib/site-seo.js';

function RobotsPage() {
  return null;
}

export async function getServerSideProps({ res }) {
  const siteUrl = getSiteUrl();
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard/',
    'Disallow: /api/',
    'Disallow: /account',
    'Disallow: /inbox',
    'Disallow: /login',
    'Disallow: /signup',
    'Disallow: /forgot-password',
    'Disallow: /auth/',
    'Disallow: /matches',
    'Disallow: /mirror-card/me',
    'Disallow: /exchange-photo',
    'Disallow: /billing/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.write(body);
  res.end();
  return { props: {} };
}

export default RobotsPage;
