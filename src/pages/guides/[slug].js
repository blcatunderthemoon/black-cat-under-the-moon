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
import { articleJsonLd, breadcrumbJsonLd, faqPageJsonLd, organizationJsonLd } from '../../lib/structured-data.js';

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

const GUIDE_FAQS = {
  'hong-kong-les-guide': [
    {
      question: '香港Les同香港女同志有分別嗎？',
      answer: '日常溝通多數互通。「Les」係口語常用叫法，「女同志」比較正式；Black Cat Under The Moon 兩個都會用。',
    },
    {
      question: '新手點樣加入香港Les社群？',
      answer: '可以由低壓方式開始：做性格測驗、睇指南、喺討論區觀察，或者用匿名漂流瓶傾訴，唔使一開始就公開身份。',
    },
    {
      question: 'Black Cat Under The Moon 係咪只係交友 app？',
      answer: '唔止。除咗配對，仲有性格測驗、匿名漂流瓶同討論區，重點係幫香港女同志認識自己同連結同路人。',
    },
  ],
};

export default function GuideDetailPage({ guide }) {
  if (!guide) return null;
  const path = `/guides/${guide.slug}`;
  const faqLd = faqPageJsonLd(GUIDE_FAQS[guide.slug]);
  const jsonLd = [
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
  ];
  if (faqLd) jsonLd.push(faqLd);

  return (
    <>
      <SeoHead
        title={guide.title}
        description={guide.description}
        path={path}
        ogType="article"
        jsonLd={jsonLd}
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
