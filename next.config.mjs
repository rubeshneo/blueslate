/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
    // Tree-shake large icon and SDK packages at build time
    optimizePackageImports: ['lucide-react', 'groq-sdk'],
  },
  // Allow scraping any franchise domain
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  compiler: {
    // Strip console.log in production builds to reduce bundle size
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
};

export default nextConfig;
