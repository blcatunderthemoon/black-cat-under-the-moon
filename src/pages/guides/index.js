/**
 * /guides — SEO article/guide listing page (file-based Markdown).
 */

import Link from 'next/link';
import AppShell from '../../components/AppShell.js';
import AppHeaderAuth from '../../components/AppHeaderAuth.js';
import ForumHeaderLogo from '../../components/ForumHeaderLogo.js';
import SeoHead from '../../components/SeoHead.js';
import { getAllGuides } from '../../lib/guides.js';
import { breadcrumbJsonLd, organizationJsonLd, webSiteJsonLd } from '../../lib/structured-data.js';

const PAGE_TITLE = '香港Les交友・香港女同志交友指南';
const PAGE_DESCRIPTION =
  '香港Les交友／香港女同志交友、香港Les配對、香港Les討論區同匿名交友指南 — 由 Black Cat Under The Moon 整理，幫香港女同志認識自己、認識彼此。';

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function GuidesIndexPage({ guides }) {
  return (
    <>
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/guides"
        jsonLd={[
          breadcrumbJsonLd([
            { name: '主頁', path: '/index.html' },
            { name: '文章', path: '/guides' },
          ]),
          organizationJsonLd(),
          webSiteJsonLd(),
        ]}
      />
      <AppShell
        headerBrand={<ForumHeaderLogo />}
        headerVariant="forum"
        breadcrumbs={[{ label: '主頁', href: '/index.html' }, { label: '文章' }]}
        maxWidth="760px"
        warmBackground
        showStarfield={false}
        pageClassName="app-page--forum app-page--guides"
        nav={<AppHeaderAuth redirectPath="/guides" />}
      >
        <header className="guides-intro">
          <h1 className="guides-intro__title">香港Les・香港女同志文章與指南</h1>
          <p className="guides-intro__lead">
            交友、約會、出櫃、相處 —— 由 Black Cat Under The Moon 為香港Les／香港女同志整理嘅實用指南。
          </p>
        </header>

        {guides.length === 0 ? (
          <p className="guides-empty">文章即將登場，敬請期待 🐈‍⬛</p>
        ) : (
          <ul className="guides-list">
            {guides.map((guide) => (
              <li key={guide.slug} className="guides-list__item">
                <Link href={`/guides/${guide.slug}`} className="guides-card">
                  <h2 className="guides-card__title">{guide.title}</h2>
                  {guide.excerpt && <p className="guides-card__excerpt">{guide.excerpt}</p>}
                  <span className="guides-card__meta">
                    {guide.date && <time dateTime={guide.date}>{formatDate(guide.date)}</time>}
                    <span className="guides-card__more">閱讀更多 →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <nav className="guides-foot">
          <a href="/index.html" className="guide-article__back">← 返回主頁</a>
        </nav>
      </AppShell>
    </>
  );
}

export async function getStaticProps() {
  const guides = getAllGuides().map(({ content, ...meta }) => meta);
  return { props: { guides } };
}
