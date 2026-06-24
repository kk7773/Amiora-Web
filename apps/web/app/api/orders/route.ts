import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createAdminClient } from '@amiora/database'
import { computeCartQuote } from '@/lib/checkout/computeCartQuote'
import { getRazorpayServerCredentials } from '@/lib/razorpay/serverConfig'
import { verifyRazorpaySignature } from '@/lib/razorpay/verifySignature'
import { createServerClient as createAuthClient } from '@/lib/supabase/server'
import type { CartLine } from '@/lib/coupons/evaluateCoupon'

type CheckoutItem = {
  product_id: string
  variant_id: string
  quantity: number
  variant_sku?: string | null
  unit_price?: number | null
  size_label?: string
  product_name?: string
  variant_label?: string
  image_url?: string | null
}

type ShippingAddressInput = {
  full_name?: string
  phone?: string
  line1?: string
  line2?: string
  city?: string
  district?: string
  state?: string
  pincode?: string
  email?: string
}

function normalizeAddress(address?: ShippingAddressInput | null) {
  if (!address) return null

  return {
    full_name: address.full_name?.trim() ?? '',
    phone: address.phone?.trim() ?? '',
    line1: address.line1?.trim() ?? '',
    line2: address.line2?.trim() ?? '',
    city: address.city?.trim() ?? '',
    district: address.district?.trim() ?? '',
    state: address.state?.trim() ?? '',
    pincode: address.pincode?.trim() ?? '',
    email: address.email?.trim().toLowerCase() ?? '',
  }
}

function validateCheckoutBody(body: {
  items?: CheckoutItem[]
  delivery_method?: string
  pickup_date?: string
  shipping_address?: ShippingAddressInput | null
  payment_method?: string
  payment_id?: string
  razorpay_order_id?: string
  razorpay_signature?: string
}): string | null {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'Cart is empty'
  }

  const deliveryMethod = body.delivery_method === 'pickup' ? 'pickup' : 'online'
  const paymentMethod = body.payment_method === 'at_store' ? 'at_store' : 'online'

  if (deliveryMethod === 'online') {
    const address = normalizeAddress(body.shipping_address)
    if (!address?.full_name || !address.phone || !address.line1 || !address.city || !address.state || !address.pincode || !address.email) {
      return 'Shipping address is incomplete'
    }
  }

  if (deliveryMethod === 'pickup' && !body.pickup_date) {
    return 'Pickup date is required'
  }

  if (paymentMethod === 'online' && (!body.payment_id || !body.razorpay_order_id || !body.razorpay_signature)) {
    return 'Payment verification details are missing'
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items?: CheckoutItem[]
      delivery_method?: string
      payment_method?: string
      store_id?: string
      pickup_date?: string
      shipping_address?: ShippingAddressInput | null
      payment_id?: string
      razorpay_order_id?: string
      razorpay_signature?: string
      status?: string
      coupon_code?: string
    }

    const validationError = validateCheckoutBody(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const authClient = await createAuthClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const adminClient = createAdminClient()
    const deliveryMethod = body.delivery_method === 'pickup' ? 'pickup' : 'online'
    const paymentMode = body.payment_method === 'at_store' ? 'pay_at_store' : 'online'
    const shippingAddress = normalizeAddress(body.shipping_address)

    const cartLines: CartLine[] = (body.items ?? []).map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      variant_sku: item.variant_sku ?? item.variant_label ?? null,
      unit_price: item.unit_price ?? null,
    }))

    const quote = await computeCartQuote(adminClient, {
      items: cartLines,
      coupon_code: body.coupon_code,
      delivery_method: deliveryMethod,
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

    if (paymentMode === 'online') {
      const { keySecret } = getRazorpayServerCredentials()
      if (!keySecret) {
        return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
      }

      const isValidSignature = verifyRazorpaySignature({
        orderId: body.razorpay_order_id!,
        paymentId: body.payment_id!,
        signature: body.razorpay_signature!,
        keySecret,
      })

      if (!isValidSignature) {
        return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
      }
    }

    const itemMap = new Map(
      (body.items ?? []).map((item) => [`${item.product_id}:${item.variant_id}`, item] as const),
    )

    const orderStatus =
      paymentMode === 'pay_at_store'
        ? 'booked_for_pickup'
        : body.status ?? 'confirmed'

    const { data: order, error } = await adminClient
      .from('orders')
      .insert({
        user_id: user?.id ?? null,
        guest_email: user?.email ?? shippingAddress?.email ?? null,
        status: orderStatus,
        payment_mode: paymentMode,
        payment_status: paymentMode === 'online' ? 'paid' : 'pending',
        payment_ref: body.payment_id ?? null,
        subtotal: quote.subtotal,
        shipping_amount: quote.shipping,
        discount_amount: quote.discount_amount,
        total_amount: quote.grand_total,
        coupon_id: quote.coupon?.id ?? null,
        coupon_code: quote.coupon?.code ?? null,
        shipping_address: deliveryMethod === 'online' ? shippingAddress : null,
        pickup_store_id: deliveryMethod === 'pickup' ? body.store_id ?? null : null,
        pickup_date: deliveryMethod === 'pickup' ? body.pickup_date ?? null : null,
        delivery_method: deliveryMethod,
        razorpay_order_id: body.razorpay_order_id ?? null,
        razorpay_payment_id: body.payment_id ?? null,
        razorpay_signature: body.razorpay_signature ?? null,
      })
      .select('id, order_number')
      .single()

    if (error || !order) {
      throw error ?? new Error('Order creation failed')
    }

    const orderItems = quote.lines.map((line) => {
      const item = itemMap.get(`${line.product_id}:${line.variant_id}`)
      return {
        order_id: order.id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.line_total,
        size_label: item?.size_label ?? '',
        product_name: item?.product_name ?? line.product_name,
        variant_label: item?.variant_label ?? item?.size_label ?? 'Default',
        metal_weight_g: line.metal_weight_g,
        image_url: item?.image_url ?? null,
      }
    })

    const { error: orderItemsError } = await adminClient.from('order_items').insert(orderItems)
    if (orderItemsError) {
      throw orderItemsError
    }

    if (quote.coupon?.id) {
      const { data: couponRow } = await adminClient
        .from('coupons')
        .select('used_count')
        .eq('id', quote.coupon.id)
        .single()

      if (couponRow) {
        await adminClient
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
  const authClient = await createAuthClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = 10

  const { data, count } = await authClient
    .from('orders')
    .select('*, order_items(*, product:products(name,slug))', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  return NextResponse.json({ orders: data ?? [], total: count ?? 0 })
}
