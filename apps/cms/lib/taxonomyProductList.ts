import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@amiora/database'
import { isCollectionProductsTableMissing } from '@/lib/collectionProductsTable'
import type { TaxonomyProductSummary } from '@/lib/syncCollectionProducts'

export type TaxonomyListParams = {
  page?: number
  limit?: number
  countOnly?: boolean
}

export type TaxonomyListResult = {
  products: TaxonomyProductSummary[]
  productCount: number
  page: number
  limit: number
  hasMore: boolean
}

const LITE_SELECT = 'id, name, slug, design_number, product_number, status'

function clampPage(page: number) {
  return Math.max(1, Math.floor(page) || 1)
}

function clampLimit(limit: number) {
  return Math.min(50, Math.max(1, Math.floor(limit) || 25))
}

function toLiteRow(
  row: {
    id: string
    name: string
    slug: string
    design_number: string | null
    product_number: number
    status: string
  },
  display_order?: number,
): TaxonomyProductSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    design_number: row.design_number,
    product_number: row.product_number,
    status: row.status,
    image_url: null,
    display_order,
  }
}

async function fetchLiteProductsByIds(
  supabase: SupabaseClient,
  productIds: string[],
  orderMap?: Record<string, number>,
): Promise<TaxonomyProductSummary[]> {
  if (productIds.length === 0) return []

  const { data, error } = await supabase
    .from('products')
    .select(LITE_SELECT)
    .in('id', productIds)

  if (error) throw new Error(error.message)

  const byId = Object.fromEntries((data ?? []).map((r) => [r.id, r]))
  return productIds
    .map((id) => {
      const row = byId[id]
      if (!row) return null
      return toLiteRow(row, orderMap?.[id])
    })
    .filter((r): r is TaxonomyProductSummary => r != null)
}

export async function fetchCollectionProductsPaginated(
  collectionId: string,
  params: TaxonomyListParams = {},
  supabase?: SupabaseClient,
): Promise<TaxonomyListResult> {
  const client = supabase ?? createServerClient()
  const page = clampPage(params.page ?? 1)
  const limit = clampLimit(params.limit ?? 25)
  const from = (page - 1) * limit
  const to = from + limit - 1

  const junctionCountRes = await client
    .from('collection_products')
    .select('product_id', { count: 'exact', head: true })
    .eq('collection_id', collectionId)

  if (junctionCountRes.error && !isCollectionProductsTableMissing(junctionCountRes.error)) {
    throw new Error(junctionCountRes.error.message)
  }

  const junctionCount = junctionCountRes.count ?? 0
  const useJunction = !junctionCountRes.error && junctionCount > 0

  if (useJunction) {
    if (params.countOnly) {
      return {
        products: [],
        productCount: junctionCount,
        page,
        limit,
        hasMore: from + limit < junctionCount,
      }
    }

    const { data: links, error: linkErr } = await client
      .from('collection_products')
      .select('product_id, display_order')
      .eq('collection_id', collectionId)
      .order('display_order', { ascending: true })
      .range(from, to)

    if (linkErr) throw new Error(linkErr.message)

    const pageLinks = links ?? []
    const productIds = pageLinks.map((l) => l.product_id)
    const orderMap = Object.fromEntries(pageLinks.map((l) => [l.product_id, l.display_order]))
    const products = await fetchLiteProductsByIds(client, productIds, orderMap)

    return {
      products,
      productCount: junctionCount,
      page,
      limit,
      hasMore: from + pageLinks.length < junctionCount,
    }
  }

  const legacyCountRes = await client
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('collection_id', collectionId)

  const productCount = legacyCountRes.count ?? 0

  if (params.countOnly) {
    return { products: [], productCount, page, limit, hasMore: from + limit < productCount }
  }

  const { data: legacyRows, error: legacyErr } = await client
    .from('products')
    .select(LITE_SELECT)
    .eq('collection_id', collectionId)
    .order('name', { ascending: true })
    .range(from, to)

  if (legacyErr) throw new Error(legacyErr.message)

  return {
    products: (legacyRows ?? []).map((r) => toLiteRow(r)),
    productCount,
    page,
    limit,
    hasMore: from + (legacyRows?.length ?? 0) < productCount,
  }
}

export async function fetchCategoryProductsPaginated(
  categoryId: string,
  params: TaxonomyListParams = {},
  supabase?: SupabaseClient,
): Promise<TaxonomyListResult> {
  const client = supabase ?? createServerClient()
  const page = clampPage(params.page ?? 1)
  const limit = clampLimit(params.limit ?? 25)
  const from = (page - 1) * limit
  const to = from + limit - 1

  const countRes = await client
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  const productCount = countRes.count ?? 0

  if (params.countOnly) {
    return { products: [], productCount, page, limit, hasMore: from + limit < productCount }
  }

  const { data, error } = await client
    .from('products')
    .select(LITE_SELECT)
    .eq('category_id', categoryId)
    .order('name', { ascending: true })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    products: (data ?? []).map((r) => toLiteRow(r)),
    productCount,
    page,
    limit,
    hasMore: from + (data?.length ?? 0) < productCount,
  }
}

export async function fetchTagProductsPaginated(
  tagId: string,
  params: TaxonomyListParams = {},
  supabase?: SupabaseClient,
): Promise<TaxonomyListResult> {
  const client = supabase ?? createServerClient()
  const page = clampPage(params.page ?? 1)
  const limit = clampLimit(params.limit ?? 25)
  const from = (page - 1) * limit
  const to = from + limit - 1

  const countRes = await client
    .from('product_tags')
    .select('product_id', { count: 'exact', head: true })
    .eq('tag_id', tagId)

  const productCount = countRes.count ?? 0

  if (params.countOnly) {
    return { products: [], productCount, page, limit, hasMore: from + limit < productCount }
  }

  const { data: links, error: linkErr } = await client
    .from('product_tags')
    .select('product_id')
    .eq('tag_id', tagId)
    .order('product_id', { ascending: true })
    .range(from, to)

  if (linkErr) throw new Error(linkErr.message)

  const productIds = (links ?? []).map((l) => l.product_id)
  const products = await fetchLiteProductsByIds(client, productIds)

  return {
    products,
    productCount,
    page,
    limit,
    hasMore: from + productIds.length < productCount,
  }
}

export function parseTaxonomyListParams(searchParams: URLSearchParams): TaxonomyListParams {
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = parseInt(searchParams.get('limit') ?? '25', 10)
  const countOnly = searchParams.get('countOnly') === '1'
  return { page, limit, countOnly }
}
