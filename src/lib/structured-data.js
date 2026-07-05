import { SITE_NAME, DEFAULT_DESCRIPTION, getSiteUrl } from './site-seo.js';

export function organizationJsonLd() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url,
    logo: `${url}/favicon.svg`,
    sameAs: [
      'https://www.instagram.com/blackcatunderthemoonhk/',
      'https://www.threads.net/@blackcatunderthemoonhk',
      'https://ko-fi.com/blackcatunderthemoon',
    ],
  };
}

export function webSiteJsonLd() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'zh-Hant',
    publisher: { '@type': 'Organization', name: SITE_NAME, url },
  };
}

export function breadcrumbJsonLd(items) {
  const base = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.path ? `${base}${item.path.startsWith('/') ? item.path : `/${item.path}`}` : undefined,
    })),
  };
}
