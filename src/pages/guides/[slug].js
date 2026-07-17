/**
 * /guides/[slug] — SEO article/guide detail page (file-based Markdown).
 */

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppShell from '../../components/AppShell.js';
import AppHeaderAuth from '../../components/AppHeaderAuth.js';
import ForumHeaderLogo from '../../components/ForumHeaderLogo.js';
import SeoHead from '../../components/SeoHead.js';
import { getAllGuideSlugs, getGuideBySlug } from '../../lib/guides.js';
import { articleJsonLd, breadcrumbJsonLd, organizationJsonLd } from '../../lib/structured-data.js';

function GuideMarkdownLink({ href, children }) {
  const safeHref = String(href || '');
  if (/^https?:\/\//i.test(safeHref)) {
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer" className="guide-article__link">
        {children}
      </a>
    );
  }
  return (
    <Link href={safeHref || '/'} className="guide-article__link">
      {children}
    </Link>
  );
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function GuideDetailPage({ guide }) {
  if (!guide) return null;
  const path = `/guides/${guide.slug}`;

  return (
    <>
      <SeoHead
        title={guide.title}
        description={guide.description}
        path={path}
        ogType="article"
        jsonLd={[
          articleJsonLd({
            title: guide.title,
            description: guide.description,
            path,
            datePublished: guide.date,
            dateModified: guide.updated,
            image: guide.cover,
          }),
          breadcrumbJsonLd([
            { name: '主頁', path: '/index.html' },
            { name: '文章', path: '/guides' },
            { name: guide.title, path },
          ]),
          organizationJsonLd(),
        ]}
      />
      <AppShell
        headerBrand={<ForumHeaderLogo />}
        headerVariant="forum"
        breadcrumbs={[
          { label: '主頁', href: '/index.html' },
          { label: '文章', href: '/guides' },
          { label: guide.title },
        ]}
        maxWidth="760px"
        warmBackground
        showStarfield={false}
        pageClassName="app-page--forum app-page--guide"
        nav={<AppHeaderAuth redirectPath={path} />}
      >
        <article className="guide-article">
          <header className="guide-article__head">
            <h1 className="guide-article__title">{guide.title}</h1>
            {guide.date && (
              <p className="guide-article__meta">
                <time dateTime={guide.date}>{formatDate(guide.date)}</time>
                <span aria-hidden="true"> · </span>
                Black Cat Under The Moon
              </p>
            )}
          </header>

          <div className="guide-article__body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ a: GuideMarkdownLink }}
            >
              {guide.content}
            </ReactMarkdown>
          </div>

          <aside className="guide-article__cta">
            <span className="guide-article__cta-icon" aria-hidden="true">🐈‍⬛</span>
            <p className="guide-article__cta-title">想認識更多香港 Les？</p>
            <p className="guide-article__cta-text">
              歡迎加入 Black Cat Under The Moon —— 香港 Les Community，
              用心理測驗認識自己，喺月光下遇見同頻的她。
            </p>
            <div className="guide-article__cta-actions">
              <Link href="/signup" className="guide-cta-btn guide-cta-btn--primary">
                免費加入 Black Cat
              </Link>
              <Link href="/forum" className="guide-cta-btn guide-cta-btn--ghost">
                去黑貓樹洞睇睇 →
              </Link>
            </div>
          </aside>

          <nav className="guide-article__foot">
            <Link href="/guides" className="guide-article__back">← 返回所有文章</Link>
            <a href="/index.html" className="guide-article__back">⌂ 返回主頁</a>
          </nav>
        </article>
      </AppShell>
    </>
  );
}

export async function getStaticPaths() {
  return {
    paths: getAllGuideSlugs().map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const guide = getGuideBySlug(params.slug);
  if (!guide) return { notFound: true };
  return { props: { guide } };
}
