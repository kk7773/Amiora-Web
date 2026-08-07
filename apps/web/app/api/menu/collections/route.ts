import { NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { resolveCollectionProductIds } from '@/lib/shop/fetchProductCards'
import { fetchProductThumbnailMap } from '@/lib/shop/fetchProductThumbnailMap'

export const revalidate = 300 // 5 min cache

async function productsForCollection(
  supabase: ReturnType<typeof createServerClient>,
  colId: string,
  limit = 5,
): Promise<{ id: string; name: string; slug: string; image_url: string | null }[]> {
  const { productIds, useIdFilter } = await resolveCollectionProductIds(supabase, colId)

  if (useIdFilter) {
    const ids = productIds.slice(0, limit)
    const thumbnailMap = await fetchProductThumbnailMap(supabase, ids)
    const { data: orderedProds } = await supabase
      .from('products')
      .select('id, name, slug')
      .in('id', ids)
      .in('status', ['active', 'make_to_order'])

    const prodById = Object.fromEntries((orderedProds ?? []).map((p) => [p.id, p]))
    return ids
      .map((id) => prodById[id])
      .filter((p): p is { id: string; name: string; slug: string } => !!p)
      .map(({ id, name, slug }) => ({ id, name, slug, image_url: thumbnailMap[id] ?? null }))
  }

  const { data: legacy } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('collection_id', colId)
    .in('status', ['active', 'make_to_order'])
    .order('created_at', { ascending: false })
    .limit(limit)

  const legacyRows = legacy ?? []
  const thumbnailMap = await fetchProductThumbnailMap(
    supabase,
    legacyRows.map((product) => product.id),
  )

  return legacyRows.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    image_url: thumbnailMap[product.id] ?? null,
  }))
}

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: collections } = await supabase
      .from('collections')
      .select('id, name, slug, thumb_url')
      .eq('is_active', true)
      .order('sort_order')
      .limit(6)

    if (!collections) return NextResponse.json({ collections: [] })

    const withProducts = await Promise.all(
      collections.map(async (col) => ({
        ...col,
        products: await productsForCollection(supabase, col.id),
      })),
    )

    return NextResponse.json({ collections: withProducts })
  } catch {
    return NextResponse.json({ collections: [] })
  }
}
