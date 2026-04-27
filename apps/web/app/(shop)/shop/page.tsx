import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { getLatestPrices }       from '@/lib/pricing/engine'
import { ProductCard }           from '@/components/product/ProductCard'
import { FilterSidebar }         from '@/components/shop/FilterSidebar'
import { SortDropdown }          from '@/components/shop/SortDropdown'
import { Pagination }            from '@/components/shop/Pagination'
import { MobileFilterDrawer }    from '@/components/shop/MobileFilterDrawer'

export const metadata: Metadata = {
  title: 'Shop All Jewellery',
  description: 'Browse our complete collection of handcrafted gold, diamond and silver jewellery.',
}

const PAGE_SIZE = 12

// Gold purities — anything that is NOT sterling silver
const GOLD_PURITIES = ['22k', '18k', '14k', '9k']
const SILVER_PURITIES = ['92.5']

interface ShopPageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params  = await searchParams
  const page    = parseInt(params['page'] ?? '1', 10)
  const sort    = params['sort'] ?? 'newest'
  const metal   = params['metal']                                    // 'gold' | 'silver' | undefined
  const purity  = params['purity']?.split(',').filter(Boolean) ?? [] // ['22k','18k',...]
  const diamond = params['diamond'] === 'true'
  const catArr  = params['category']?.split(',').filter(Boolean) ?? []

  const supabase = createServerClient()
  const prices   = await getLatestPrices()

  // ─────────────────────────────────────────────────────────────────
  // Step 1 — Resolve product IDs from variant-level filters
  //          (metal, purity, diamond cannot be filtered directly on
  //           the products table — they live in product_variants)
  // ─────────────────────────────────────────────────────────────────
  const idSets: string[][] = []

  // Metal / Purity constraint
  if (metal || purity.length > 0) {
    type VRow = { product_id: string }
    let vq = supabase.from('product_variants').select('product_id')

    if (purity.length > 0) {
      // Specific purities override the metal selection
      vq = vq.in('purity', purity)
    } else if (metal === 'silver') {
      vq = vq.in('purity', SILVER_PURITIES)
    } else if (metal === 'gold') {
      vq = vq.in('purity', GOLD_PURITIES)
    }

    const { data } = await vq
    idSets.push([...new Set((data ?? [] as VRow[]).map((r: VRow) => r.product_id))])
  }

  // Diamond / gemstone constraint
  if (diamond) {
    type VRow = { product_id: string }
    const { data } = await supabase
      .from('product_variants')
      .select('product_id')
      .gt('gem_price_override', 0)
    idSets.push([...new Set((data ?? [] as VRow[]).map((r: VRow) => r.product_id))])
  }

  // Intersect all ID sets (AND logic across filters)
  const validIds: string[] | null = idSets.length > 0
    ? idSets.reduce((a, b) => a.filter((id) => b.includes(id)))
    : null

  // Short-circuit: constraints exist but intersection is empty → no results
  if (validIds !== null && validIds.length === 0) {
    return (
      <div className="section-x py-10">
        <div className="mb-8">
          <h1 className="font-display text-display-xl text-ink">All Jewellery</h1>
          <p className="text-sm text-ink-muted mt-1">0 pieces available</p>
        </div>
        <div className="py-24 text-center">
          <p className="font-display text-xl text-ink-muted mb-4">No products match your filters</p>
          <p className="text-sm text-ink-faint mb-6">Try adjusting or clearing your filters</p>
          <a href="/shop" className="text-sm text-teal underline underline-offset-4">Clear all filters</a>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // Step 2 — Build the main products query
  // ─────────────────────────────────────────────────────────────────
  let query = supabase
    .from('products')
    .select('id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,product_images(*),product_variants(*)', { count: 'exact' })
    .eq('is_active', true)

  // Apply resolved product-ID constraint from variant filters
  if (validIds !== null) {
    query = query.in('id', validIds)
  }

  // Category filter — resolve slug → UUID first
  if (catArr.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id')
      .in('slug', catArr)
    const catIds = (cats ?? []).map((c: { id: string }) => c.id)
    if (catIds.length > 0) {
      query = query.in('category_id', catIds)
    } else {
      // Slugs exist in filter but no matching categories found
      query = query.in('id', []) // force empty result
    }
  }

  // Sort
  const orderMap: Record<string, { col: string; asc: boolean }> = {
    newest:     { col: 'created_at', asc: false },
    price_asc:  { col: 'sort_order', asc: true  },
    price_desc: { col: 'sort_order', asc: false },
    popular:    { col: 'sort_order', asc: true  },
    rated:      { col: 'sort_order', asc: true  },
  }
  const o = orderMap[sort] ?? orderMap['newest']!
  query = query
    .order(o.col, { ascending: o.asc })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const { data: rows, count } = await query

  // ─────────────────────────────────────────────────────────────────
  // Step 3 — Attach live prices to each product
  // ─────────────────────────────────────────────────────────────────
  const products = (rows ?? []).map((p) =>
    attachCardPrice(
      {
        ...p,
        product_variants: p.product_variants ?? [],
      },
      prices.gold?.pricePerGram ?? 7200,
      prices.silver?.pricePerGram ?? 90
    )
  )

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="section-x py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-xl text-ink">All Jewellery</h1>
        <p className="text-sm text-ink-muted mt-1">{count ?? 0} pieces available</p>
      </div>

      <div className="flex gap-10">
        <div className="hidden lg:block w-56 shrink-0">
          <Suspense><FilterSidebar /></Suspense>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6 gap-4">
            <Suspense><MobileFilterDrawer /></Suspense>
            <p className="text-sm text-ink-muted hidden sm:block">
              Showing {count ? `${Math.min((page - 1) * PAGE_SIZE + 1, count)}–${Math.min(page * PAGE_SIZE, count)} of ${count}` : '0'}
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
            <Pagination total={count ?? 0} pageSize={PAGE_SIZE} page={page} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
