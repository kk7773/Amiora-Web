import type { SupabaseClient } from '@supabase/supabase-js'
import { getProductHref } from '@/lib/shop/paths'
import { PRODUCT_CATEGORY_EMBED, PRODUCT_COLLECTION_EMBED } from '@/lib/shop/mapProductForCard'

export type SearchSuggestionLite = {
  id: string
  name: string
  slug: string
  href: string
  imageUrl: string | null
  subtitle: string | null
}

type ProductRow = {
  id: string
  name: string
  slug: string
  design_number: string | null
  collection: { name: string; slug: string } | { name: string; slug: string }[] | null
  category: { name: string; slug: string } | { name: string; slug: string }[] | null
}

function sanitizePattern(q: string) {
  return `%${q.replace(/[%_]/g, '')}%`
}

function relOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapRow(row: ProductRow): SearchSuggestionLite {
  const collection = relOne(row.collection)
  const category = relOne(row.category)

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    href: getProductHref({
      slug: row.slug,
      collectionSlug: collection?.slug ?? null,
      categorySlug: category?.slug ?? null,
    }),
    imageUrl: null,
    subtitle: collection?.name ?? category?.name ?? row.design_number ?? null,
  }
}

export async function fetchSearchSuggestions(
  supabase: SupabaseClient,
  q: string,
  limit = 8,
): Promise<SearchSuggestionLite[]> {
  const pattern = sanitizePattern(q)
  const numMatch = /^\d+$/.test(q) ? parseInt(q, 10) : null

  const select =
    `id, name, slug, design_number, collection:${PRODUCT_COLLECTION_EMBED}(name, slug), category:${PRODUCT_CATEGORY_EMBED}(name, slug)`

  const textPromise = supabase
    .from('products')
    .select(select)
    .eq('status', 'active')
    .or(`name.ilike.${pattern},slug.ilike.${pattern},design_number.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(limit)

  const numPromise =
    numMatch != null
      ? supabase
          .from('products')
          .select(select)
          .eq('status', 'active')
          .eq('product_number', numMatch)
          .limit(limit)
      : Promise.resolve({ data: [] as ProductRow[], error: null })

  const [textRes, numRes] = await Promise.all([textPromise, numPromise])

  if (textRes.error) throw new Error(textRes.error.message)

  const seen = new Set<string>()
  const rows: ProductRow[] = []

  for (const row of [...(textRes.data ?? []), ...(numRes.data ?? [])] as ProductRow[]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
    if (rows.length >= limit) break
  }

  return rows.map(mapRow)
}

export async function fetchSearchThumbnails(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, string | null>> {
  const thumbnails: Record<string, string | null> = Object.fromEntries(ids.map((id) => [id, null]))
  if (ids.length === 0) return thumbnails

  const { data: images } = await supabase
    .from('product_images')
    .select('product_id, url, is_primary')
    .in('product_id', ids)
    .order('is_primary', { ascending: false })

  const seen = new Set<string>()
  for (const row of images ?? []) {
    if (seen.has(row.product_id)) continue
    const url = row.url?.trim()
    if (url) {
      thumbnails[row.product_id] = url
      seen.add(row.product_id)
    }
  }

  const missing = ids.filter((id) => !thumbnails[id])
  if (missing.length === 0) return thumbnails

  const { data: groups } = await supabase
    .from('product_color_groups')
    .select('product_id, images, display_order, is_active')
    .in('product_id', missing)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const byProduct = new Map<string, { images?: string[] | null }[]>()
  for (const g of groups ?? []) {
    const list = byProduct.get(g.product_id) ?? []
    list.push(g)
    byProduct.set(g.product_id, list)
  }

  for (const pid of missing) {
    for (const g of byProduct.get(pid) ?? []) {
      const url = g.images?.find((u) => typeof u === 'string' && u.trim())
      if (url) {
        thumbnails[pid] = url.trim()
        break
      }
    }
  }

  return thumbnails
}
