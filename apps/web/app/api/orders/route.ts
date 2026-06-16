import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import {
  aggregateCartComponents,
  evaluateCoupon,
  type CartLine,
  type CouponRow,
} from '@/lib/coupons/evaluateCoupon'

const SHIPPING_FEE = 199
const FREE_SHIPPING_THRESHOLD = 5000

function computeShipping(subtotalAfterCoupon: number, deliveryMethod: string): number {
  if (deliveryMethod === 'pickup') return 0
  return subtotalAfterCoupon >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items: {
        product_id: string
        variant_id: string
        quantity: number
        unit_price: number
        size_label: string
        metal_weight_g?: number
        metal_rate_per_gram?: number
      }[]
      total_amount: number
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

    const subtotal = body.items.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
      0,
    )

    let discountAmount = 0
    let couponId: string | null = null
    let couponCode: string | null = null

    if (body.coupon_code?.trim()) {
      const code = body.coupon_code.toUpperCase().trim()
      const cartLines: CartLine[] = body.items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
      }))

      const components = await aggregateCartComponents(supabase, cartLines)

      const { data: coupon, error: couponErr } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single()

      if (couponErr || !coupon) {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 })
      }

      const evaluation = evaluateCoupon(coupon as CouponRow, components)
      if (!evaluation.applicable) {
        return NextResponse.json(
          { error: evaluation.reason ?? 'Coupon is not applicable to this order' },
          { status: 400 },
        )
      }

      discountAmount = evaluation.total_discount
      couponId = (coupon as CouponRow).id
      couponCode = (coupon as CouponRow).code
    }

    const subtotalAfterCoupon = Math.max(0, subtotal - discountAmount)
    const shipping = computeShipping(subtotalAfterCoupon, body.delivery_method)
    const authoritativeTotal = subtotalAfterCoupon + shipping

    if (Math.abs(authoritativeTotal - Number(body.total_amount)) > 1) {
      return NextResponse.json(
        { error: 'Order total mismatch. Please refresh checkout and try again.' },
        { status: 400 },
      )
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: user?.id ?? null,
        total_amount: authoritativeTotal,
        discount_amount: discountAmount,
        coupon_id: couponId,
        coupon_code: couponCode,
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
      body.items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        size_label: item.size_label,
        metal_weight_g:
          item.metal_weight_g != null && Number.isFinite(item.metal_weight_g)
            ? item.metal_weight_g
            : null,
      })),
    )

    if (couponId) {
      const { data: couponRow } = await supabase
        .from('coupons')
        .select('used_count')
        .eq('id', couponId)
        .single()

      if (couponRow) {
        await supabase
          .from('coupons')
          .update({ used_count: (couponRow.used_count ?? 0) + 1 })
          .eq('id', couponId)
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
