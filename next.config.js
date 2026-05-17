/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Supprime l'en-tête "X-Powered-By: Next.js"
  poweredByHeader: false,

  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  experimental: {
    // Inline le CSS critique — nécessite la dépendance "critters"
    optimizeCss: true,
  },

  staticPageGenerationTimeout: 120,

  // En-têtes de sécurité en fallback (le middleware les pose aussi sur les routes dynamiques)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
