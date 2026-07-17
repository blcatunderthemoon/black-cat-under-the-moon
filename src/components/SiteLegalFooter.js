/**
 * Global legal footer — visible on all Next.js pages for PayPal / compliance crawlers.
 */

const LEGAL_LINKS = [
  { href: '/about.html', label: '關於我們' },
  { href: '/guides', label: '文章／指南' },
  { href: '/contact.html', label: '聯絡我們' },
  { href: '/tos.html', label: '使用條款' },
  { href: '/privacy.html', label: '私隱政策' },
  { href: '/refund.html', label: '退款與取消政策' },
];

export default function SiteLegalFooter() {
  return (
    <footer className="site-footer site-footer--legal site-footer--app">
      <nav className="site-footer__nav site-footer__nav--legal" aria-label="法律與聯絡">
        {LEGAL_LINKS.map((link, i) => (
          <span key={link.href} className="site-footer__nav-item">
            {i > 0 && <span className="site-legal-sep" aria-hidden="true">|</span>}
            <a href={link.href} className="site-legal-link">
              {link.label}
            </a>
          </span>
        ))}
      </nav>
      <p className="site-footer__copy site-footer__copy--legal">
        © 2026 Black Cat Under The Moon. All rights reserved.
      </p>
    </footer>
  );
}

/** HTML snippet for static public pages */
export const STATIC_LEGAL_FOOTER_HTML = `
<footer class="site-footer site-footer--legal" id="site-footer">
  <nav class="site-footer__nav site-footer__nav--legal" aria-label="法律與聯絡">
    <a class="site-legal-link" href="about.html">關於我們</a>
    <span class="site-legal-sep" aria-hidden="true">|</span>
    <a class="site-legal-link" href="/guides">文章／指南</a>
    <span class="site-legal-sep" aria-hidden="true">|</span>
    <a class="site-legal-link" href="contact.html">聯絡我們</a>
    <span class="site-legal-sep" aria-hidden="true">|</span>
    <a class="site-legal-link" href="tos.html">使用條款</a>
    <span class="site-legal-sep" aria-hidden="true">|</span>
    <a class="site-legal-link" href="privacy.html">私隱政策</a>
    <span class="site-legal-sep" aria-hidden="true">|</span>
    <a class="site-legal-link" href="refund.html">退款與取消政策</a>
  </nav>
  <p class="site-footer__copy site-footer__copy--legal">© 2026 Black Cat Under The Moon. All rights reserved.</p>
</footer>`;
