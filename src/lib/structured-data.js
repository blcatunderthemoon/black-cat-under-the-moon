import { SITE_NAME, DEFAULT_DESCRIPTION, getSiteUrl } from './site-seo.js';

export function organizationJsonLd() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url,
    logo: `${url}/blackcatunderthemoonlogo.png`,
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
    alternateName: [
      '香港Les交友',
      '香港女同志交友',
      '香港Les配對',
      '香港Les討論區',
      '香港Les匿名交友',
      '香港Les社群',
      '香港女同志社群',
      'Black Cat Under The Moon',
    ],
    url,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'zh-Hant',
    publisher: { '@type': 'Organization', name: SITE_NAME, url },
  };
}

/** FAQPage schema — helps rich results for informational queries. */
export function faqPageJsonLd(faqs) {
  const items = (faqs || [])
    .filter((f) => f && f.question && f.answer)
    .map((f) => ({
      '@type': 'Question',
      name: String(f.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: String(f.answer),
      },
    }));
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items,
  };
}

export function articleJsonLd({ title, description, path: articlePath, datePublished, dateModified, image }) {
  const base = getSiteUrl();
  const url = articlePath
    ? `${base}${articlePath.startsWith('/') ? articlePath : `/${articlePath}`}`
    : base;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    inLanguage: 'zh-Hant',
    mainEntityOfPage: url,
    url,
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified || datePublished ? { dateModified: dateModified || datePublished } : {}),
    ...(image ? { image: image.startsWith('http') ? image : `${base}${image}` } : {}),
    author: { '@type': 'Organization', name: SITE_NAME, url: base },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: base,
      logo: { '@type': 'ImageObject', url: `${base}/blackcatunderthemoonlogo.png` },
    },
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
