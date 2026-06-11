import Link from 'next/link'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { fetchShopListing, SHOP_PAGE_SIZE } from '@/lib/shop/fetchShopListing'
import {
  buildPriceListingHref,
  getPriceListingDescription,
  getPriceListingTitle,
  getScopeLabel,
  JEWELLERY_SCOPE,
  type PriceListingPath,
} from '@/lib/shop/priceListingSlugs'
import { parsePriceRangeParam } from '@/lib/shop/priceRanges'
import { FilterSidebar } from '@/components/shop/FilterSidebar'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import { ShopListingClient } from '@/components/shop/ShopListingClient'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildListingPageSchemas, toSchemaProductItem } from '@/lib/seo/jsonLd'

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
  const listingPath = buildPriceListingHref(listing.scope, listing.rangeId)
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
          <Suspense><MobileFilterDrawer /></Suspense>
          <Suspense>
            <ShopListingClient
              initialProducts={products as Parameters<typeof ShopListingClient>[0]['initialProducts']}
              total={total}
              pageSize={SHOP_PAGE_SIZE}
              initialPage={listing.page}
              initialSort={listing.sort}
              filters={{
                category: categoryFilter,
                price: listing.rangeId,
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
