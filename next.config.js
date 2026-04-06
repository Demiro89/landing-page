/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Disable font optimization - fonts are loaded via CDN at runtime
  optimizeFonts: false,
  // Increase static generation timeout
  staticPageGenerationTimeout: 120,
};

module.exports = nextConfig;
