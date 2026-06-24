import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { fetchShopListing } from '@/lib/shop/fetchShopListing'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const supabase = createServerClient()

    const metalRaw = searchParams.get('metal')
    const purityRaw = searchParams.get('purity')
    const categoryRaw = searchParams.get('category')

    const result = await fetchShopListing(supabase, {
      page: Number.parseInt(searchParams.get('page') ?? '1', 10),
      sort: searchParams.get('sort') ?? 'newest',
      metal: metalRaw ? metalRaw.split(',').filter(Boolean) : [],
      purity: purityRaw ? purityRaw.split(',').filter(Boolean) : [],
      diamond: searchParams.get('diamond') === 'true',
      category: categoryRaw ? categoryRaw.split(',').filter(Boolean) : [],
      collection: searchParams.get('collection') ?? undefined,
      price: searchParams.get('price'),
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ products: [], total: 0, page: 1, pageSize: 12 })
  }
}
