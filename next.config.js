/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    // Inline le CSS critique — nécessite la dépendance "critters"
    optimizeCss: true,
  },
  // Increase static generation timeout
  staticPageGenerationTimeout: 120,
};

module.exports = nextConfig;
