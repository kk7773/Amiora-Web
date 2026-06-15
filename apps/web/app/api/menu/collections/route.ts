import { NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { resolveCollectionProductIds } from '@/lib/shop/fetchProductCards'

export const revalidate = 300 // 5 min cache

async function productsForCollection(
  supabase: ReturnType<typeof createServerClient>,
  colId: string,
  limit = 5,
): Promise<{ name: string; slug: string }[]> {
  const { productIds, useIdFilter } = await resolveCollectionProductIds(supabase, colId)

  if (useIdFilter) {
    const ids = productIds.slice(0, limit)
    const { data: orderedProds } = await supabase
      .from('products')
      .select('id, name, slug')
      .in('id', ids)
      .eq('status', 'active')

    const prodById = Object.fromEntries((orderedProds ?? []).map((p) => [p.id, p]))
    return ids
      .map((id) => prodById[id])
      .filter((p): p is { id: string; name: string; slug: string } => !!p)
      .map(({ name, slug }) => ({ name, slug }))
  }

  const { data: legacy } = await supabase
    .from('products')
    .select('name, slug')
    .eq('collection_id', colId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)

  return legacy ?? []
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
