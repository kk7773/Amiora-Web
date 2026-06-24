import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { fetchShopListing, SHOP_PAGE_SIZE } from '@/lib/shop/fetchShopListing'
import { FilterSidebar } from '@/components/shop/FilterSidebar'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import { ShopListingClient } from '@/components/shop/ShopListingClient'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildListingPageSchemas, toSchemaProductItem } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'Shop All Jewellery',
  description: 'Browse our complete collection of handcrafted gold, diamond and silver jewellery.',
}

interface ShopPageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams
  const initialPage = Math.max(1, parseInt(params['page'] ?? '1', 10))
  const initialSort = params['sort'] ?? 'newest'
  const metal = params['metal']?.split(',').filter(Boolean) ?? []
  const purity = params['purity']?.split(',').filter(Boolean) ?? []
  const diamond = params['diamond'] === 'true'
  const catArr = params['category']?.split(',').filter(Boolean) ?? []

  const supabase = createServerClient()
  const { products, total } = await fetchShopListing(supabase, {
    page: initialPage,
    sort: initialSort,
    metal,
    purity,
    diamond,
    category: catArr,
  })

  const schemaProducts = products.map((p) =>
    toSchemaProductItem(p as { name: string; slug: string; basePrice?: number; product_images?: { url: string; is_primary?: boolean }[] }),
  )

  return (
    <div className="section-x py-10">
      <JsonLd
        data={buildListingPageSchemas({
          name: 'Shop All Jewellery',
          description: 'Browse our complete collection of handcrafted gold, diamond and silver jewellery.',
          path: '/shop',
          breadcrumb: [
            { name: 'Home', href: '/' },
            { name: 'Shop', href: '/shop' },
          ],
          products: schemaProducts,
          total,
        })}
      />
      <div className="mb-8">
        <h1 className="font-display text-display-xl text-ink">All Jewellery</h1>
        <p className="text-sm text-ink-muted mt-1">{total} pieces available</p>
      </div>

      <div className="flex gap-10">
        <div className="hidden lg:block w-56 shrink-0">
          <Suspense><FilterSidebar /></Suspense>
        </div>

        <div className="flex-1 min-w-0">
          <Suspense><MobileFilterDrawer /></Suspense>
          <Suspense>
            <ShopListingClient
              initialProducts={products as Parameters<typeof ShopListingClient>[0]['initialProducts']}
              total={total}
              pageSize={SHOP_PAGE_SIZE}
              initialPage={initialPage}
              initialSort={initialSort}
              filters={{
                metal,
                purity,
                diamond,
                category: catArr,
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
