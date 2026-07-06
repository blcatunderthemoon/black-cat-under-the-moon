import '../styles/globals.css';
import '../styles/pixel-theme.css';
import '../styles/mobile.css';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { AuthProvider } from '../lib/auth-context.js';
import { isNoIndexPath } from '../lib/site-seo.js';
import MobileKeyboardGuard from '../components/MobileKeyboardGuard.js';
import PostHogAnalytics from '../components/PostHogAnalytics.js';
import AppErrorBoundary from '../components/AppErrorBoundary.js';

const AUTH_PATHS = new Set(['/login', '/signup', '/forgot-password', '/auth/confirm', '/auth/reset-password']);

function isAuthPath(pathname) {
  if (AUTH_PATHS.has(pathname)) return true;
  return pathname.startsWith('/auth/');
}

function DashboardAuthGate({ children }) {
  const [authed, setAuthed] = useState(false);
  const [secured, setSecured] = useState(null); // null = checking
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('dashKey') || '';
    fetch('/api/dashboard/ping', {
      headers: stored ? { 'x-dashboard-key': stored } : {},
    })
      .then((r) => r.json())
      .then(({ secured, valid }) => {
        if (!secured) {
          setSecured(false);
          setAuthed(true);
          return;
        }
        setSecured(true);
        if (valid && stored) {
          setAuthed(true);
        } else {
          sessionStorage.removeItem('dashKey');
          setAuthed(false);
        }
      })
      .catch(() => {
        setSecured(true);
        sessionStorage.removeItem('dashKey');
        setAuthed(false);
      });
  }, []);

  if (secured === null) return null;
  if (authed) return children;

  async function handleSubmit(e) {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key) { setError('請輸入 Dashboard 金鑰。'); return; }
    setError('');
    try {
      const res = await fetch('/api/dashboard/ping', {
        headers: { 'x-dashboard-key': key },
      });
      const data = await res.json();
      if (!data.secured || data.valid) {
        sessionStorage.setItem('dashKey', key);
        setAuthed(true);
      } else {
        setError('金鑰錯誤，請確認與 .env 內 DASHBOARD_SECRET 一致。');
      }
    } catch {
      setError('無法驗證金鑰，請重試。');
    }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#050914' }}>
      <form onSubmit={handleSubmit} style={{ background:'#0b0d22', border:'1px solid #1d2055', borderRadius:12, padding:40, minWidth:320, display:'flex', flexDirection:'column', gap:16 }}>
        <h2 style={{ color:'#bd93f9', margin:0, fontFamily:'Noto Sans TC, sans-serif' }}>Dashboard 金鑰</h2>
        <input
          type="password"
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          placeholder="輸入 DASHBOARD_SECRET"
          autoFocus
          style={{ padding:'10px 14px', borderRadius:8, border:'1px solid #1d2055', background:'#050914', color:'#f0ebd8', fontSize:14, outline:'none' }}
        />
        {error && <p style={{ color:'#ff6b9d', margin:0, fontSize:13 }}>{error}</p>}
        <button type="submit" style={{ padding:'10px 0', borderRadius:8, background:'#7c5cfc', color:'#fff', border:'none', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          進入 Dashboard
        </button>
      </form>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isDashboard = router.pathname.startsWith('/dashboard');
  const isAuthPage = isAuthPath(router.pathname);
  const noindex = isNoIndexPath(router.pathname);

  return (
    <AuthProvider>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, interactive-widget=resizes-content"
        />
        {noindex && <meta name="robots" content="noindex, nofollow" />}
        {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
          <meta
            name="google-site-verification"
            content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
          />
        )}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preload" href="/js/zpix.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/css/auth-nav.css" />
        <link rel="stylesheet" href="/css/mobile-webview-scroll.css?v=20260706safari" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <MobileKeyboardGuard />
      {!isDashboard && !isAuthPage && <PostHogAnalytics />}
      {!isDashboard && (
        <Script src="/js/mobile-document-scroll.js?v=20260710a" strategy="afterInteractive" />
      )}
      <AppErrorBoundary>
      {isDashboard ? (
        <DashboardAuthGate>
          <Component {...pageProps} />
        </DashboardAuthGate>
      ) : (
        <Component {...pageProps} />
      )}
      </AppErrorBoundary>
    </AuthProvider>
  );
}

