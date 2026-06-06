import Link from 'next/link'
import { headers } from 'next/headers'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildWebPageJsonLd } from '@/lib/seo/jsonLd'

const AUTH_TITLES: Record<string, string> = {
  '/login': 'Login',
  '/register': 'Create Account',
  '/forgot-password': 'Forgot Password',
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const path = headersList.get('x-canonical-path') ?? '/login'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f5f0] to-[#eee8df] flex flex-col items-center justify-center px-4 py-16">
      <JsonLd
        data={buildWebPageJsonLd({
          name: AUTH_TITLES[path] ?? 'Account',
          path,
        })}
      />
      <Link href="/" className="mb-10 text-center">
        <p className="font-display text-4xl tracking-[0.3em] text-deep-teal">AMIORA</p>
        <p className="text-[10px] tracking-[0.4em] uppercase text-ink-faint mt-1">Diamonds &amp; Fine Jewellery</p>
      </Link>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-black/5 border border-white p-8">
        {children}
      </div>

      <p className="mt-8 text-xs text-ink-faint text-center">
        © {new Date().getFullYear()} AMIORA Diamonds. All rights reserved.
      </p>
    </div>
  )
}
