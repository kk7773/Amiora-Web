import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { fetchPurityMapForProducts } from '@/lib/pricing/fetchPurityMap'
import { getLatestPrices } from '@/lib/pricing/engine'
import { mapProductForCard, PRODUCT_CARD_SELECT, type ProductCardRaw } from '@/lib/shop/mapProductForCard'

export async function POST(req: NextRequest) {
  try {
    const { product_ids } = (await req.json()) as { product_ids: string[] }

    const supabase = createServerClient()
    const prices   = await getLatestPrices()
    const goldPrice = prices.gold?.pricePerGram ?? 7200
    const silverPrice = prices.silver?.pricePerGram ?? 90
    const diamondPrice = prices.diamond?.pricePerGram ?? 0

    const { data: pairs } = await supabase
      .from('smart_pairs')
      .select('paired_product_id')
      .in('product_id', product_ids)
      .limit(8)

    const pairedIds = pairs?.map((p) => p.paired_product_id) ?? []
    const ids = pairedIds.filter((id) => !product_ids.includes(id))

    let products: ProductCardRaw[] = []
    if (ids.length > 0) {
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_CARD_SELECT)
        .in('id', ids.slice(0, 4))
        .in('status', ['active', 'make_to_order'])
      products = (data ?? []) as ProductCardRaw[]
    }

    if (products.length < 4) {
      const { data: featured } = await supabase
        .from('products')
        .select(PRODUCT_CARD_SELECT)
        .in('status', ['active', 'make_to_order'])
        .eq('is_featured', true)
        .not('id', 'in', `(${product_ids.join(',')})`)
        .limit(4 - products.length)
      products = [...products, ...((featured ?? []) as ProductCardRaw[])]
    }

    const purityMap = await fetchPurityMapForProducts(supabase, products)

    const withPrices = products.map((p) =>
      mapProductForCard(p, goldPrice, silverPrice, purityMap, diamondPrice),
    )

    return NextResponse.json({ products: withPrices })
  } catch {
    return NextResponse.json({ products: [] })
  }
}
