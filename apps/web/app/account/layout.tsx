import { headers } from 'next/headers'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildWebPageJsonLd } from '@/lib/seo/jsonLd'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AccountSidebar } from '@/components/account/AccountSidebar'
import { AccountMobileNav } from '@/components/account/AccountMobileNav'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

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
      <div className="section-x py-6 md:py-10 min-h-screen pb-[calc(62px+env(safe-area-inset-bottom))] md:pb-10">
        <AccountMobileNav className="md:hidden mb-6" />
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <div className="hidden md:block">
            <AccountSidebar />
          </div>
          <main>{children}</main>
        </div>
      </div>
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
    </>
  )
}
