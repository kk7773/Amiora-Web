import { NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'

export const revalidate = 300 // 5 min cache

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
      collections.map(async (col) => {
        const { data: products } = await supabase
          .from('products')
          .select('name, slug')
          .eq('collection_id', col.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5)

        return { ...col, products: products ?? [] }
      })
    )

    return NextResponse.json({ collections: withProducts })
  } catch {
    return NextResponse.json({ collections: [] })
  }
}
