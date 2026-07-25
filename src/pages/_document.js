import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-Hant">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/css/auth-nav.css?v=20260725catfull" />
        <link rel="stylesheet" href="/css/mobile-webview-scroll.css?v=20260713echo" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body data-analytics-surface="next">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
