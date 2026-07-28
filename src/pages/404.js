/**
 * Custom Next.js 404 — matches public/404.html tone (Moonlight / pixel).
 */

import Link from 'next/link';
import SeoHead from '../components/SeoHead.js';
import { ForumMoonIcon } from '../components/UiIcons.js';

export default function NotFoundPage() {
  return (
    <>
      <SeoHead
        title="404"
        description="找不到這個頁面。"
        path="/404"
        noindex
      />
      <main className="app-404">
        <div className="app-404__card">
          <p className="app-404__code" aria-hidden="true">404</p>
          <p className="app-404__subtitle">PAGE NOT FOUND</p>
          <span className="app-404__moon" aria-hidden="true">
            <ForumMoonIcon size={28} />
          </span>
          <p className="app-404__msg">
            喵～找不到這個頁面。
            <br />
            也許它躲進月光裡了？
          </p>
          <Link href="/index.html" className="app-404__home">
            ⌂ 主頁
          </Link>
        </div>
      </main>
    </>
  );
}
