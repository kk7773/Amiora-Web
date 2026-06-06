import type { SupabaseClient } from '@supabase/supabase-js'
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { fetchPurityMapForProducts } from '@/lib/pricing/fetchPurityMap'
import { getLatestPrices } from '@/lib/pricing/engine'
import { resolveProductCardImages } from '@/lib/shop/resolveProductCardImages'
import { matchesPriceRange, parsePriceRangeParam } from '@/lib/shop/priceRanges'

export const SHOP_PAGE_SIZE = 12

/** Map URL purity tokens to `metal_purities.code` (18, 14, 09). */
export function purityParamsToCodes(params: string[]): string[] {
  const out: string[] = []
  for (const raw of params) {
    const n = raw.replace(/\.?k$/i, '').trim()
    if (!n) continue
    const code = n.length === 1 ? `0${n}` : n.padStart(2, '0')
    out.push(code)
  }
  return [...new Set(out)]
}

export type ShopListingFilters = {
  page?: number
  sort?: string
  metal?: string
  purity?: string[]
  diamond?: boolean
  category?: string[]
  price?: string | null
}

type RawProductRow = {
  id: string
  name: string
  slug: string
  created_at: string
  making_charge_pct: number
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?: number | null
  stone_lines?: unknown
  product_images?: Parameters<typeof resolveProductCardImages>[1]
  product_color_groups?: Parameters<typeof resolveProductCardImages>[2]
  product_variants?: unknown[]
  collection?: { slug?: string } | null
  category?: { slug?: string } | null
}

export type ShopListingProduct = RawProductRow & {
  product_images: ReturnType<typeof resolveProductCardImages>
  collectionSlug: string | null
  categorySlug: string | null
  basePrice: number
  discountPercentOff: number | null
}

export async function fetchShopListing(
  supabase: SupabaseClient,
  filters: ShopListingFilters,
  pageSize = SHOP_PAGE_SIZE,
) {
  const page = Math.max(1, filters.page ?? 1)
  const sort = filters.sort ?? 'newest'
  const metal = filters.metal
  const purity = filters.purity ?? []
  const diamond = filters.diamond ?? false
  const catArr = filters.category ?? []
  const priceBucket = parsePriceRangeParam(filters.price ?? null)

  const prices = await getLatestPrices()
  const goldPerGram = prices.gold?.pricePerGram ?? 7200
  const silverPerGram = prices.silver?.pricePerGram ?? 90

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
      const { data: prow } = await supabase
        .from('metal_purities')
        .select('id')
        .eq('is_active', true)
        .in('code', codes)

      const pidList = ((prow ?? []) as PurityRow[]).map((r) => r.id)
      if (pidList.length === 0) {
        idSets.push([])
      } else {
        const { data } = await supabase
          .from('product_variants')
          .select('product_id')
          .in('purity_id', pidList)
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

  const validIds: string[] | null = idSets.length > 0
    ? idSets.reduce((a, b) => a.filter((id) => b.includes(id)))
    : null

  if (validIds !== null && validIds.length === 0) {
    return { products: [] as ShopListingProduct[], total: 0, page, pageSize }
  }

  let query = supabase
    .from('products')
    .select(
      'id,name,slug,created_at,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,stone_lines,collection:collections(slug),category:categories(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(*)',
    )
    .eq('status', 'active')

  if (validIds !== null) {
    query = query.in('id', validIds)
  }

  if (catArr.length > 0) {
    const { data: cats } = await supabase.from('categories').select('id').in('slug', catArr)
    const catIds = (cats ?? []).map((c: { id: string }) => c.id)
    if (catIds.length > 0) {
      query = query.in('category_id', catIds)
    } else {
      return { products: [] as ShopListingProduct[], total: 0, page, pageSize }
    }
  }

  const { data: rows } = await query.order('created_at', { ascending: false })
  const purityMap = await fetchPurityMapForProducts(supabase, rows ?? [])

  let priced: ShopListingProduct[] = (rows ?? []).map((p) => {
    const raw = p as RawProductRow
    const images = resolveProductCardImages(raw.name, raw.product_images, raw.product_color_groups)
    return attachCardPrice(
      {
        ...raw,
        collectionSlug: raw.collection?.slug ?? null,
        categorySlug: raw.category?.slug ?? null,
        product_images: images,
        product_variants: (raw.product_variants ?? []) as {
          id: string
          price?: number
          stock_qty: number
          is_active?: boolean
          metal_weight_g?: number | null
          purity_id?: string
        }[],
      },
      goldPerGram,
      silverPerGram,
      purityMap,
    ) as ShopListingProduct
  })

  if (priceBucket) {
    priced = priced.filter((p) => matchesPriceRange(p.basePrice, priceBucket))
  }

  if (sort === 'price_asc') {
    priced.sort((a, b) => a.basePrice - b.basePrice || a.name.localeCompare(b.name))
  } else if (sort === 'price_desc') {
    priced.sort((a, b) => b.basePrice - a.basePrice || a.name.localeCompare(b.name))
  }

  const total = priced.length
  const start = (page - 1) * pageSize
  const products = priced.slice(start, start + pageSize)

  return { products, total, page, pageSize }
}
