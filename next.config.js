// 📄 FILE: next.config.js

/** @type {import('next').NextConfig} */

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "img-src 'self' https: data:",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "connect-src 'self' https://vercel.live https://www.google-analytics.com",
  "frame-src https://js.stripe.com",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security',  value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options',     value: 'nosniff' },
  { key: 'X-Frame-Options',            value: 'DENY' },
  { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy',    value: CSP },
];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  optimizeFonts: false,
  staticPageGenerationTimeout: 120,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
