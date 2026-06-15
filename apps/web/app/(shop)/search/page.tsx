import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { fetchPurityMapForProducts } from '@/lib/pricing/fetchPurityMap'
import { getLatestPrices } from '@/lib/pricing/engine'
import { mapProductForCard, type ProductCardRaw } from '@/lib/shop/mapProductForCard'
import { fetchActiveProductCards } from '@/lib/shop/fetchProductCards'
import { ProductCard }           from '@/components/product/ProductCard'
import { SearchInput }           from './SearchInput'
import { SearchX, Sparkles }     from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildSearchResultsJsonLd, buildWebPageJsonLd, toSchemaProductItem } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'Search | Amiora Diamonds',
  description: 'Search our collection of handcrafted gold, diamond and silver jewellery.',
}

interface SearchPageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query  = (params['q'] ?? '').trim()

  // ── Empty state — no query yet ──────────────────────────────────────────────
  if (!query) {
    return (
      <div className="section-x py-14">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-display-xl text-ink mb-8 text-center">Search</h1>
          <SearchInput defaultValue="" />
          <div className="mt-20 flex flex-col items-center gap-4 text-center">
            <Sparkles className="h-10 w-10 text-teal/40" />
            <p className="font-display text-xl text-ink-muted">Discover your perfect piece</p>
            <p className="text-sm text-ink-faint max-w-sm">
              Search by jewellery name, metal type, or occasion — earrings, rings, necklaces and more.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Query Supabase ──────────────────────────────────────────────────────────
  const supabase = createServerClient()
  const prices   = await getLatestPrices()

  const { products: rows, error: searchError } = await fetchActiveProductCards(supabase, {
    apply: (q) => q.ilike('name', `%${query.replace(/[%_]/g, '')}%`),
    order: { column: 'created_at', ascending: false },
    limit: 48,
  })

  if (searchError) {
    console.error('[SearchPage] product query:', searchError)
  }

  const purityMap = await fetchPurityMapForProducts(supabase, rows ?? [])
  const goldPrice = prices.gold?.pricePerGram ?? 7200
  const silverPrice = prices.silver?.pricePerGram ?? 90

  const products = (rows ?? []).map((p) =>
    mapProductForCard(p as ProductCardRaw, goldPrice, silverPrice, purityMap),
  )

  const schemaProducts = products.map((p) =>
    toSchemaProductItem(p as { name: string; slug: string; basePrice?: number; product_images?: { url: string; is_primary?: boolean }[] }),
  )

  return (
    <div className="section-x py-14">
      <JsonLd
        data={[
          buildWebPageJsonLd({
            name: 'Search',
            description: 'Search AMIORA jewellery collection.',
            path: `/search?q=${encodeURIComponent(query)}`,
          }),
          buildSearchResultsJsonLd({ query, items: schemaProducts }),
        ]}
      />
      {/* Header row */}
      <div className="max-w-2xl mx-auto mb-10">
        <h1 className="font-display text-display-xl text-ink mb-6 text-center">Search</h1>
        <SearchInput defaultValue={query} />
      </div>

      {/* Result count */}
      <p className="text-sm text-ink-muted mb-6">
        {products.length === 0
          ? `No results for "${query}"`
          : `${products.length} result${products.length !== 1 ? 's' : ''} for "${query}"`}
      </p>

      {/* Results grid */}
      {products.length === 0 ? (
        <div className="py-24 flex flex-col items-center gap-4 text-center">
          <SearchX className="h-12 w-12 text-ink-faint" />
          <p className="font-display text-xl text-ink-muted">No products found</p>
          <p className="text-sm text-ink-faint max-w-xs">
            Try a different spelling or browse all jewellery below.
          </p>
          <a
            href="/shop"
            className="mt-2 text-sm text-teal underline underline-offset-4 hover:text-deep-teal transition-colors"
          >
            Browse all jewellery →
          </a>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product as Parameters<typeof ProductCard>[0]['product']}
            />
          ))}
        </div>
      )}
    </div>
  )
}
