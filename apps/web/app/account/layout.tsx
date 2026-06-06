import { headers } from 'next/headers'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildWebPageJsonLd } from '@/lib/seo/jsonLd'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AccountSidebar } from '@/components/account/AccountSidebar'

const ACCOUNT_TITLES: Record<string, string> = {
  '/account': 'My Profile',
  '/account/orders': 'My Orders',
  '/account/wishlist': 'My Wishlist',
  '/account/requests': 'My Requests',
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const path = headersList.get('x-canonical-path') ?? '/account'

  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd({
          name: ACCOUNT_TITLES[path] ?? 'My Account',
          path,
        })}
      />
      <Header />
      <div className="section-x py-10 min-h-screen">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <AccountSidebar />
          <main>{children}</main>
        </div>
      </div>
      <Footer />
    </>
  )
}
