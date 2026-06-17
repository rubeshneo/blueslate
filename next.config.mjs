/** @type {import('next').NextConfig} */
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline/unsafe-eval for SSR hydration and dev HMR
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${appUrl} https://*.supabase.co wss://*.supabase.co https://api.vapi.ai https://api.groq.com https://r.jina.ai`,
  "frame-ancestors 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: CSP },
]

const CORS_HEADERS = [
  { key: 'Access-Control-Allow-Origin',  value: appUrl },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-vapi-signature' },
]

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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
      {
        source: '/api/(.*)',
        headers: CORS_HEADERS,
      },
    ]
  },
};

export default nextConfig;
