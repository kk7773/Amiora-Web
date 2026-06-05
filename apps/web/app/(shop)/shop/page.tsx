import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { fetchPurityMapForProducts } from '@/lib/pricing/fetchPurityMap'
import { getLatestPrices } from '@/lib/pricing/engine'
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

/** Map URL purity tokens to `metal_purities.code` (18, 14, 09). */
function purityParamsToCodes(params: string[]): string[] {
  const out: string[] = []
  for (const raw of params) {
    const n = raw.replace(/\.?k$/i, '').trim()
    if (!n) continue
    const code = n.length === 1 ? `0${n}` : n.padStart(2, '0')
    out.push(code)
  }
  return [...new Set(out)]
}

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
  // Step 1 — Resolve product IDs from variant / product-level filters
  // ─────────────────────────────────────────────────────────────────
  const idSets: string[][] = []

  if (metal || purity.length > 0) {
    type VRow = { product_id: string }
    type PurityRow = { id: string }
    let codes: string[] = []
    if (purity.length > 0) {
      codes = purityParamsToCodes(purity)
    } else if (metal === 'gold') {
      codes = ['18', '14', '09']
    } else if (metal === 'silver') {
      idSets.push([])
      codes = []
    }

    if (codes.length === 0 && metal !== 'silver') {
      /* no-op */
    } else if (metal === 'silver') {
      /* already pushed empty */
    } else {
      const { data: prow } = await supabase.from('metal_purities').select('id').eq('is_active', true).in('code', codes)

      const pidList = ((prow ?? []) as PurityRow[]).map((r) => r.id)
      if (pidList.length === 0) {
        idSets.push([])
      } else {
        const { data } = await supabase.from('product_variants').select('product_id').in('purity_id', pidList)
        idSets.push([...new Set((data ?? [] as VRow[]).map((r: VRow) => r.product_id))])
      }
    }
  }

  if (diamond) {
    const { data } = await supabase
      .from('products')
      .select('id')
      .eq('status', 'active')
      .or('diamond_count.gt.0,total_diamond_wt.gt.0')
    idSets.push((data ?? []).map((r: { id: string }) => r.id))
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
    .select('id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,stone_lines,collection:collections(slug),category:categories(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(*)', { count: 'exact' })
    .eq('status', 'active')

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
    price_asc:  { col: 'created_at', asc: true  },
    price_desc: { col: 'created_at', asc: false },
    popular:    { col: 'created_at', asc: false },
    rated:      { col: 'created_at', asc: false },
  }
  const o = orderMap[sort] ?? orderMap['newest']!
  query = query
    .order(o.col, { ascending: o.asc })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const { data: rows, count } = await query
  const purityMap = await fetchPurityMapForProducts(supabase, rows ?? [])

  // ─────────────────────────────────────────────────────────────────
  // Step 3 — Attach live prices to each product
  // ─────────────────────────────────────────────────────────────────
  const products = (rows ?? []).map((p: any) => {
    // If product_images is empty, generate from product_color_groups
    let images = p.product_images ?? []
    if (images.length === 0 && p.product_color_groups && p.product_color_groups.length > 0) {
      // Collect all images from color groups
      const colorGroupImages: { url: string; alt_text: string | null; is_primary: boolean; is_hover: boolean }[] = []
      for (let i = 0; i < p.product_color_groups.length; i++) {
        const cg = p.product_color_groups[i]
        if (cg && Array.isArray(cg.images)) {
          for (let j = 0; j < cg.images.length; j++) {
            const imgUrl = cg.images[j]
            colorGroupImages.push({
              url: imgUrl,
              alt_text: `${p.name} — image ${colorGroupImages.length + 1}`,
              is_primary: colorGroupImages.length === 0, // First image is primary
              is_hover: colorGroupImages.length === 1,   // Second image is hover
            })
          }
        }
      }
      images = colorGroupImages
    }
    
    return attachCardPrice(
      {
        ...p,
        collectionSlug: (p.collection as { slug?: string } | null)?.slug ?? null,
        categorySlug: (p.category as { slug?: string } | null)?.slug ?? null,
        product_images: images,
        product_variants: p.product_variants ?? [],
      },
      prices.gold?.pricePerGram ?? 7200,
      prices.silver?.pricePerGram ?? 90,
      purityMap,
    )
  })

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
