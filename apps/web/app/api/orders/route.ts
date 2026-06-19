import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { computeCartQuote } from '@/lib/checkout/computeCartQuote'
import type { CartLine } from '@/lib/coupons/evaluateCoupon'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items: {
        product_id: string
        variant_id: string
        quantity: number
        size_label: string
      }[]
      delivery_method: string
      payment_method?: string
      store_id?: string
      pickup_date?: string
      shipping_address?: object
      payment_id?: string
      razorpay_order_id?: string
      status?: string
      coupon_code?: string
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const cartLines: CartLine[] = body.items.map((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      quantity: i.quantity,
    }))

    const quote = await computeCartQuote(supabase, {
      items: cartLines,
      coupon_code: body.coupon_code,
      delivery_method: body.delivery_method,
      validateStock: true,
    })

    if (quote.lines.length === 0) {
      return NextResponse.json(
        { error: quote.errors[0] ?? 'Cart is invalid' },
        { status: 400 },
      )
    }

    if (body.coupon_code?.trim() && !quote.coupon) {
      return NextResponse.json(
        { error: quote.errors.find((e) => e.toLowerCase().includes('coupon')) ?? 'Coupon is not applicable' },
        { status: 400 },
      )
    }

    const itemErrors = quote.errors.filter((e) => !e.toLowerCase().includes('coupon'))
    if (itemErrors.length > 0) {
      return NextResponse.json({ error: itemErrors[0] }, { status: 400 })
    }

    const sizeByKey = new Map(
      body.items.map((i) => [`${i.product_id}:${i.variant_id}`, i.size_label ?? '']),
    )

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: user?.id ?? null,
        total_amount: quote.grand_total,
        discount_amount: quote.discount_amount,
        coupon_id: quote.coupon?.id ?? null,
        coupon_code: quote.coupon?.code ?? null,
        status: body.status ?? 'pending',
        payment_method: body.payment_method ?? 'online',
        store_id: body.store_id ?? null,
        pickup_date: body.pickup_date ?? null,
        shipping_address: body.shipping_address ?? null,
        razorpay_payment_id: body.payment_id ?? null,
      })
      .select('id, order_number')
      .single()

    if (error || !order) throw error ?? new Error('Order creation failed')

    await supabase.from('order_items').insert(
      quote.lines.map((line) => ({
        order_id: order.id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        size_label: sizeByKey.get(`${line.product_id}:${line.variant_id}`) ?? '',
        metal_weight_g: line.metal_weight_g,
      })),
    )

    if (quote.coupon?.id) {
      const { data: couponRow } = await supabase
        .from('coupons')
        .select('used_count')
        .eq('id', quote.coupon.id)
        .single()

      if (couponRow) {
        await supabase
          .from('coupons')
          .update({ used_count: (couponRow.used_count ?? 0) + 1 })
          .eq('id', quote.coupon.id)
      }
    }

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
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = 10

  const { data, count } = await supabase
    .from('orders')
    .select('*, order_items(*, product:products(name,slug))', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  return NextResponse.json({ orders: data ?? [], total: count ?? 0 })
}
