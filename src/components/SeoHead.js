/**
 * Per-page SEO meta — title, description, canonical, Open Graph, JSON-LD.
 */

import Head from 'next/head';
import {
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  absoluteUrl,
} from '../lib/site-seo.js';

const DEFAULT_OG_IMAGE = '/favicon.svg';

export default function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  noindex = false,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt,
  jsonLd,
}) {
  const pageTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME}`;
  const canonical = path ? absoluteUrl(path) : undefined;
  const image = ogImage.startsWith('http') ? ogImage : absoluteUrl(ogImage);
  const imageAlt = ogImageAlt || pageTitle;
  const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}
      />
      {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
        <meta
          name="google-site-verification"
          content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
        />
      )}
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:locale" content="zh_Hant" />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {schemas.map((schema) => (
        <script
          // eslint-disable-next-line react/no-danger
          key={schema['@type'] || JSON.stringify(schema).slice(0, 40)}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </Head>
  );
}
