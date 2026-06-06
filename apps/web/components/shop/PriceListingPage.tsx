import Link from 'next/link'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { fetchShopListing, SHOP_PAGE_SIZE } from '@/lib/shop/fetchShopListing'
import {
  getPriceListingDescription,
  getPriceListingTitle,
  getScopeLabel,
  JEWELLERY_SCOPE,
  type PriceListingPath,
} from '@/lib/shop/priceListingSlugs'
import { parsePriceRangeParam } from '@/lib/shop/priceRanges'
import { ProductCard } from '@/components/product/ProductCard'
import { FilterSidebar } from '@/components/shop/FilterSidebar'
import { SortDropdown } from '@/components/shop/SortDropdown'
import { Pagination } from '@/components/shop/Pagination'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildListingPageSchemas, toSchemaProductItem } from '@/lib/seo/jsonLd'
import { buildPriceListingHref } from '@/lib/shop/priceListingSlugs'

interface PriceListingPageProps {
  listing: PriceListingPath
}

export async function PriceListingPage({ listing }: PriceListingPageProps) {
  const range = parsePriceRangeParam(listing.rangeId)
  if (!range) return null

  const supabase = createServerClient()
  const categoryFilter =
    listing.scope === JEWELLERY_SCOPE ? [] : [listing.scope]

  const { products, total } = await fetchShopListing(supabase, {
    page: listing.page,
    sort: listing.sort,
    category: categoryFilter,
    price: listing.rangeId,
  })

  const title = getPriceListingTitle(listing.scope, range)
  const scopeLabel = getScopeLabel(listing.scope)
  const listingPath = buildPriceListingHref(listing.scope, listing.rangeId, {
    sort: listing.sort,
    page: listing.page,
  })
  const schemaProducts = products.map((p) =>
    toSchemaProductItem(p as { name: string; slug: string; basePrice?: number; product_images?: { url: string; is_primary?: boolean }[] }),
  )
  const breadcrumb = [
    { name: 'Home', href: '/' },
    { name: 'Shop', href: '/shop' },
    ...(listing.scope !== JEWELLERY_SCOPE
      ? [{ name: scopeLabel, href: `/shop/${listing.scope}` }]
      : []),
    { name: range.label, href: listingPath },
  ]

  return (
    <div className="section-x py-10">
      <JsonLd
        data={buildListingPageSchemas({
          name: title,
          description: getPriceListingDescription(listing.scope, range),
          path: listingPath,
          breadcrumb,
          products: schemaProducts,
          total,
        })}
      />
      <nav className="flex items-center gap-1 text-xs text-ink-muted mb-6 flex-wrap">
        <Link href="/" className="hover:text-teal transition-colors">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-teal transition-colors">Shop</Link>
        {listing.scope !== JEWELLERY_SCOPE && (
          <>
            <span>/</span>
            <Link href={`/shop/${listing.scope}`} className="hover:text-teal transition-colors">
              {scopeLabel}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-ink">{range.label}</span>
      </nav>

      <div className="mb-8">
        <p className="text-2xs uppercase tracking-widest2 text-teal mb-2">Shop by price</p>
        <h1 className="font-display text-display-xl text-ink">{title}</h1>
        <p className="text-sm text-ink-muted mt-2 max-w-2xl">
          {getPriceListingDescription(listing.scope, range)}
        </p>
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
              Showing {total ? `${Math.min((listing.page - 1) * SHOP_PAGE_SIZE + 1, total)}–${Math.min(listing.page * SHOP_PAGE_SIZE, total)} of ${total}` : '0'}
            </p>
            <Suspense><SortDropdown /></Suspense>
          </div>

          {products.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display text-xl text-ink-muted mb-4">No products in this price range</p>
              <p className="text-sm text-ink-faint mb-6">Try another range or browse all jewellery</p>
              <Link href="/shop" className="text-sm text-teal underline underline-offset-4">
                Browse all
              </Link>
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
            <Pagination total={total} pageSize={SHOP_PAGE_SIZE} page={listing.page} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
