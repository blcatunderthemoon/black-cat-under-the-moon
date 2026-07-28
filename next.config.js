const path = require('path');
const os = require('os');

/**
 * Webpack's persistent filesystem cache (`*.pack.gz`) is the chronic OneDrive
 * corruption source: OneDrive locks/renames those blobs mid-write, spamming
 * "ENOENT rename ...pack.gz_" and eventually corrupting the dev build.
 * We move ONLY that cache outside OneDrive (%LOCALAPPDATA%). It's plain cache
 * blobs, so it doesn't need Node module resolution and is safe to delete.
 *
 * NOTE: distDir itself must stay INSIDE the project — the compiled server files
 * `require('next/...')` / `react/jsx-dev-runtime`, which resolve by walking up
 * for node_modules. A distDir outside the project has no node_modules above it
 * and every API route / _document throws MODULE_NOT_FOUND.
 */
function resolveDevWebpackCacheDir() {
  const localAppData = process.env.LOCALAPPDATA
    || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(localAppData, 'blackcat-under-the-moon-next', 'webpack-cache');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local dev only: keep cache under node_modules (less OneDrive corruption than
  // repo-root .next), while staying inside the project so module resolution works.
  // Production / Vercel must use the default `.next` so routes-manifest.json is found.
  ...(process.env.NODE_ENV === 'development'
    ? { distDir: 'node_modules/.cache/next' }
    : {}),
  async redirects() {
    return [
      { source: '/', destination: '/index.html', permanent: false },
      { source: '/forum.html', destination: '/forum', permanent: false },
      { source: '/login.html', destination: '/login', permanent: false },
      { source: '/signup.html', destination: '/signup', permanent: false },
      { source: '/match.html', destination: '/echo.html', permanent: true },
      { source: '/moonlight-interest', destination: '/moonlight-interest001', permanent: true },
      { source: '/moonlight-interest/', destination: '/moonlight-interest001', permanent: true },
    ];
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://us.i.posthog.com https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://challenges.cloudflare.com https://api-m.paypal.com https://api-m.sandbox.paypal.com https://api.cloudinary.com https://*.cloudinary.com",
      "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "trusted-types twKxV6 default goog#html nextjs nextjs#bundler ProseMirrorClipboard",
    ].join('; ');

    const corsImageHeaders = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ];

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
      {
        source: '/:file(.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico))',
        headers: corsImageHeaders,
      },
    ];
  },
  webpack(config, { dev }) {
    // OneDrive / Windows: polling avoids stale or missing .next page bundles.
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      };
      // Move the persistent webpack cache out of OneDrive to stop the recurring
      // "ENOENT rename ...pack.gz_" corruption that blanks pages.
      if (config.cache && typeof config.cache === 'object') {
        config.cache.cacheDirectory = resolveDevWebpackCacheDir();
      }
    }
    return config;
  },
};

module.exports = nextConfig;
