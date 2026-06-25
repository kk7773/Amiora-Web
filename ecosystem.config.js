// PM2 Ecosystem Config — run both Next.js apps on Hostinger VPS
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'amiora-web',
      script: 'node',
      args: 'apps/web/.next/standalone/apps/web/server.js',
      cwd: '/var/www/amiora',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        // ── Supabase ──────────────────────────────────────────────────────────
        NEXT_PUBLIC_SUPABASE_URL: 'https://ifbyzgelotoneozqhomy.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmYnl6Z2Vsb3RvbmVvenFob215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3OTM1OTgsImV4cCI6MjA5MTM2OTU5OH0.upEOlzz946l7NspzYGgdr3SY4EySjsGzIpEqoPdybWbY',
        SUPABASE_SERVICE_ROLE_KEY: 'FILL_IN_SERVICE_ROLE_KEY',
        // ── Site ──────────────────────────────────────────────────────────────
        NEXT_PUBLIC_SITE_URL: 'https://amioradiamonds.com',
        // ── Cloudinary ────────────────────────────────────────────────────────
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'dqayol6fn',
        CLOUDINARY_CLOUD_NAME: 'dqayol6fn',
        CLOUDINARY_API_KEY: 'FILL_IN_CLOUDINARY_API_KEY',
        CLOUDINARY_API_SECRET: 'FILL_IN_CLOUDINARY_API_SECRET',
        // ── Razorpay ──────────────────────────────────────────────────────────
        RAZORPAY_MODE: 'live',
        NEXT_PUBLIC_RAZORPAY_MODE: 'live',
        NEXT_PUBLIC_RAZORPAY_KEY_ID: 'FILL_IN_RAZORPAY_KEY_ID',
        RAZORPAY_KEY_ID: 'FILL_IN_RAZORPAY_KEY_ID',
        RAZORPAY_KEY_SECRET: 'FILL_IN_RAZORPAY_SECRET',
        // ── Misc ──────────────────────────────────────────────────────────────
        CMS_SECRET: 'FILL_IN_SAME_CMS_SECRET',
        GOLD_API_KEY: 'FILL_IN_GOLD_API_KEY',
      },
    },
    {
      name: 'amiora-cms',
      script: 'node',
      args: 'apps/cms/.next/standalone/apps/cms/server.js',
      cwd: '/var/www/amiora',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '0.0.0.0',
        // ── Supabase ──────────────────────────────────────────────────────────
        NEXT_PUBLIC_SUPABASE_URL: 'https://ifbyzgelotoneozqhomy.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmYnl6Z2Vsb3RvbmVvenFob215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3OTM1OTgsImV4cCI6MjA5MTM2OTU5OH0.upEOlzz946l7NspzYGgdr3SY4EySjsGzIpEqoPdybWbY',
        SUPABASE_SERVICE_ROLE_KEY: 'FILL_IN_SERVICE_ROLE_KEY',
        // ── CMS Config ────────────────────────────────────────────────────────
        NEXT_PUBLIC_STOREFRONT_URL: 'https://amioradiamonds.com',
        NEXT_PUBLIC_CMS_URL: 'https://cms.amioradiamonds.com',
        SITE_URL: 'https://cms.amioradiamonds.com',
        CMS_SECRET: 'FILL_IN_SAME_CMS_SECRET',
        CMS_PRICING_SECRET: 'FILL_IN_PRICING_SECRET',
        // ── Cloudinary ────────────────────────────────────────────────────────
        CLOUDINARY_CLOUD_NAME: 'dqayol6fn',
        CLOUDINARY_API_KEY: 'FILL_IN_CLOUDINARY_API_KEY',
        CLOUDINARY_API_SECRET: 'FILL_IN_CLOUDINARY_API_SECRET',
      },
    },
  ],
}
