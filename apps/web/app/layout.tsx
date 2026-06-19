import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import { Toaster } from 'sonner'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/seo/jsonLd'
import { canonicalFromPath, getSiteUrl } from '@/lib/seo/site'
import '@/styles/globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['400', '500', '600'],
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  weight: ['400', '500'],
  display: 'swap',
})

const SITE_URL = getSiteUrl()

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const path = headersList.get('x-canonical-path') ?? '/'
  const canonical = canonicalFromPath(path)

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: 'Amiora Diamonds | Premium Jewellery',
      template: '%s | Amiora Diamonds',
    },
    description:
      'Handcrafted gold, diamond and silver jewellery. BIS hallmarked, live pricing, free shipping on orders ₹5000+.',
    keywords: ['diamond jewellery', 'gold jewellery', 'silver jewellery', 'hallmarked jewellery India'],
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      siteName: 'Amiora Diamonds',
      url: canonical,
    },
    alternates: {
      canonical,
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${cormorant.variable} ${jost.variable} font-body bg-bg text-ink antialiased`}
        suppressHydrationWarning
      >
        <JsonLd data={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]} />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
