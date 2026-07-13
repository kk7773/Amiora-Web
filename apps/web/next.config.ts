import type { NextConfig } from 'next'
import path from 'path'

const monorepoRoot = path.resolve(__dirname, '../..')

const nextConfig: NextConfig = {
  transpilePackages: ['@amiora/ui', '@amiora/database', '@amiora/types', '@amiora/pricing'],
  outputFileTracingRoot: monorepoRoot,
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' as const } : {}),

  images: {
    formats: ['image/avif', 'image/webp'],   // modern formats → 40-60% smaller
    minimumCacheTTL: 3600,                   // CDN cache images for 1h
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co',         pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com',    pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com',   pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com',     pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com',     pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },

  experimental: {
    // Tree-shake these large packages — only used icons/components get bundled
    optimizePackageImports: ['@amiora/ui', 'lucide-react', 'framer-motion', 'gsap'],
  },

  compress: true,
  logging: { fetches: { fullUrl: false } },
}

export default nextConfig
