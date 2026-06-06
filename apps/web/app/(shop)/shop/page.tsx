import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { fetchShopListing, SHOP_PAGE_SIZE } from '@/lib/shop/fetchShopListing'
import { ProductCard }           from '@/components/product/ProductCard'
import { FilterSidebar }         from '@/components/shop/FilterSidebar'
import { SortDropdown }          from '@/components/shop/SortDropdown'
import { Pagination }            from '@/components/shop/Pagination'
import { MobileFilterDrawer }    from '@/components/shop/MobileFilterDrawer'
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
  const page = parseInt(params['page'] ?? '1', 10)
  const sort = params['sort'] ?? 'newest'
  const metal = params['metal']
  const purity = params['purity']?.split(',').filter(Boolean) ?? []
  const diamond = params['diamond'] === 'true'
  const catArr = params['category']?.split(',').filter(Boolean) ?? []
  const supabase = createServerClient()
  const { products, total } = await fetchShopListing(supabase, {
    page,
    sort,
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
          <div className="flex items-center justify-between mb-6 gap-4">
            <Suspense><MobileFilterDrawer /></Suspense>
            <p className="text-sm text-ink-muted hidden sm:block">
              Showing {total ? `${Math.min((page - 1) * SHOP_PAGE_SIZE + 1, total)}–${Math.min(page * SHOP_PAGE_SIZE, total)} of ${total}` : '0'}
            </p>
            <Suspense><SortDropdown /></Suspense>
          </div>

          {products.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display text-xl text-ink-muted mb-4">No products match your filters</p>
              <p className="text-sm text-ink-faint mb-6">Try adjusting or clearing your filters</p>
              <a href="/shop" className="text-sm text-teal underline underline-offset-4">Clear all filters</a>
            </div>
          ) : (
            <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product as Parameters<typeof ProductCard>[0]['product']}
                />
              ))}
            </div>
          )}

          <Suspense>
            <Pagination total={total} pageSize={SHOP_PAGE_SIZE} page={page} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
