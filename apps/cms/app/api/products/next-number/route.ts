import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'

/** Next `product_number` for a category (max + 1). */
export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get('category_id')
  if (!categoryId) {
    return NextResponse.json({ error: 'category_id required' }, { status: 400 })
  }
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('products')
      .select('product_number')
      .eq('category_id', categoryId)
      .order('product_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[next-number]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const next = (data?.product_number ?? 0) + 1
    return NextResponse.json({ product_number: next })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
