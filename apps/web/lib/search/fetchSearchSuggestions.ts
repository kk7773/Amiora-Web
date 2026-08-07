import type { SupabaseClient } from '@supabase/supabase-js'
import { getProductHref } from '@/lib/shop/paths'
import { fetchProductThumbnailMap } from '@/lib/shop/fetchProductThumbnailMap'
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
    .in('status', ['active', 'make_to_order'])
    .or(`name.ilike.${pattern},slug.ilike.${pattern},design_number.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(limit)

  const numPromise =
    numMatch != null
      ? supabase
          .from('products')
          .select(select)
          .in('status', ['active', 'make_to_order'])
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
  return fetchProductThumbnailMap(supabase, ids)
}
