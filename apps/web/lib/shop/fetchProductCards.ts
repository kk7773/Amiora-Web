import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PRODUCT_CARD_SELECT,
  PRODUCT_CATEGORY_EMBED,
  PRODUCT_COLLECTION_EMBED,
  type ProductCardRaw,
} from '@/lib/shop/mapProductForCard'

/** Minimal columns — safe when optional migrations/columns are missing. */
export const PRODUCT_CARD_SELECT_LITE =
  `id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,collection:${PRODUCT_COLLECTION_EMBED}(slug),category:${PRODUCT_CATEGORY_EMBED}(slug),product_images(url,alt_text,is_primary,is_hover),product_variants(id,sku,price,stock_qty,metal_weight_g,purity_id,is_active)`

/** Listing pages need created_at for sorting. */
export const PRODUCT_LISTING_SELECT_FULL =
  `id,name,slug,created_at,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,stone_lines,collection:${PRODUCT_COLLECTION_EMBED}(slug),category:${PRODUCT_CATEGORY_EMBED}(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(id,sku,price,stock_qty,metal_weight_g,purity_id,is_active)`

export const PRODUCT_LISTING_SELECT_LITE =
  `id,name,slug,created_at,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,collection:${PRODUCT_COLLECTION_EMBED}(slug),category:${PRODUCT_CATEGORY_EMBED}(slug),product_images(url,alt_text,is_primary,is_hover),product_variants(id,sku,price,stock_qty,metal_weight_g,purity_id,is_active)`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProductQuery = any

export type ProductQueryApplier = (query: ProductQuery) => ProductQuery

function logQueryError(label: string, message: string) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[fetchProductCards] ${label}:`, message)
  }
}

/**
 * Run a product query with full select; on failure retry with lite select.
 */
export async function runProductQuery<T>(
  supabase: SupabaseClient,
  fullSelect: string,
  liteSelect: string,
  apply: ProductQueryApplier,
): Promise<{ data: T[]; error: string | null }> {
  const fullResult = await apply(
    supabase.from('products').select(fullSelect).eq('status', 'active'),
  )

  if (!fullResult.error && fullResult.data) {
    return { data: fullResult.data as T[], error: null }
  }

  if (fullResult.error) {
    logQueryError('full select failed', fullResult.error.message)
  }

  const liteResult = await apply(
    supabase.from('products').select(liteSelect).eq('status', 'active'),
  )

  if (liteResult.error) {
    logQueryError('lite select failed', liteResult.error.message)
    return { data: [], error: liteResult.error.message }
  }

  return { data: (liteResult.data ?? []) as T[], error: null }
}

export type FetchActiveProductCardsOptions = {
  select?: 'card' | 'listing'
  limit?: number
  order?: { column: string; ascending?: boolean }
  ids?: string[]
  collectionId?: string
  categoryIds?: string[]
  /** Extra filters e.g. `.eq('is_new_arrival', true)` */
  apply?: ProductQueryApplier
}

export async function fetchActiveProductCards(
  supabase: SupabaseClient,
  options: FetchActiveProductCardsOptions = {},
): Promise<{ products: ProductCardRaw[]; error: string | null }> {
  const useListing = options.select === 'listing'
  const fullSelect = useListing ? PRODUCT_LISTING_SELECT_FULL : PRODUCT_CARD_SELECT
  const liteSelect = useListing ? PRODUCT_LISTING_SELECT_LITE : PRODUCT_CARD_SELECT_LITE

  const apply: ProductQueryApplier = (base) => {
    let q = base

    if (options.apply) {
      q = options.apply(q)
    }

    if (options.ids?.length) {
      q = q.in('id', options.ids)
    }

    if (options.collectionId) {
      q = q.eq('collection_id', options.collectionId)
    }

    if (options.categoryIds?.length) {
      q = q.in('category_id', options.categoryIds)
    }

    if (options.order) {
      q = q.order(options.order.column, { ascending: options.order.ascending ?? false })
    }

    if (options.limit != null) {
      q = q.limit(options.limit)
    }

    return q
  }

  const { data, error } = await runProductQuery<ProductCardRaw>(
    supabase,
    fullSelect,
    liteSelect,
    apply,
  )

  return { products: data, error }
}

/** Union junction + legacy collection_id product IDs for a collection. */
export async function resolveCollectionProductIds(
  supabase: SupabaseClient,
  collectionId: string,
): Promise<{
  productIds: string[]
  orderMap: Record<string, number>
  useIdFilter: boolean
}> {
  const { data: links, error: linksErr } = await supabase
    .from('collection_products')
    .select('product_id, display_order')
    .eq('collection_id', collectionId)
    .order('display_order', { ascending: true })

  const linkRows = linksErr ? [] : (links ?? [])
  const orderMap = Object.fromEntries(
    linkRows.map((r: { product_id: string; display_order: number }) => [r.product_id, r.display_order]),
  )

  const { data: legacyRows } = await supabase
    .from('products')
    .select('id')
    .eq('collection_id', collectionId)
    .eq('status', 'active')

  const junctionIds = linkRows.map((r: { product_id: string }) => r.product_id)
  const legacyIds = (legacyRows ?? []).map((r: { id: string }) => r.id)
  const productIds = [...new Set([...junctionIds, ...legacyIds])]

  return {
    productIds,
    orderMap,
    useIdFilter: productIds.length > 0,
  }
}
