import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items:            {
        product_id: string
        variant_id: string
        quantity: number
        unit_price: number
        size_label: string
        metal_weight_g?: number
        metal_rate_per_gram?: number
      }[]
      total_amount:     number
      delivery_method:  string
      payment_method?:  string
      store_id?:        string
      pickup_date?:     string
      shipping_address?: object
      payment_id?:      string
      status?:          string
    }

    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id:          user?.id ?? null,
        total_amount:     body.total_amount,
        status:           body.status ?? 'pending',
        payment_method:   body.payment_method ?? 'online',
        store_id:         body.store_id ?? null,
        pickup_date:      body.pickup_date ?? null,
        shipping_address: body.shipping_address ?? null,
        razorpay_payment_id: body.payment_id ?? null,
      })
      .select('id, order_number')
      .single()

    if (error || !order) throw error ?? new Error('Order creation failed')

    // Insert order items
    await supabase.from('order_items').insert(
      body.items.map((item) => ({
        order_id:   order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity:   item.quantity,
        unit_price: item.unit_price,
        size_label: item.size_label,
        metal_weight_g:
          item.metal_weight_g != null && Number.isFinite(item.metal_weight_g)
            ? item.metal_weight_g
            : null,
      }))
    )

    return NextResponse.json({ order_number: order.order_number })
  } catch (err) {
    console.error('[orders POST]', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page     = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = 10

  const { data, count } = await supabase
    .from('orders')
    .select('*, order_items(*, product:products(name,slug))', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  return NextResponse.json({ orders: data ?? [], total: count ?? 0 })
}
