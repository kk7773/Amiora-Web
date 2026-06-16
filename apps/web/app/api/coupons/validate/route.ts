import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  aggregateCartComponents,
  evaluateCoupon,
  type CartLine,
  type CouponRow,
} from '@/lib/coupons/evaluateCoupon'

/**
 * POST /api/coupons/validate
 *
 * Discount strategy: coupons apply ONLY to making charges and/or gem/stone price.
 * Never on the metal price or the overall order total.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    code: string
    making_charge?: number
    gem_price?: number
    items?: CartLine[]
  }
  const { code, items } = body

  if (!code) {
    return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
  }

  const supabase = await createServerClient()

  let components = {
    making: Number(body.making_charge ?? 0),
    gem: Number(body.gem_price ?? 0),
  }

  if (Array.isArray(items) && items.length > 0) {
    components = await aggregateCartComponents(supabase, items)
  }

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single()

  if (error || !coupon) {
    return NextResponse.json({ error: 'Invalid coupon code' }, { status: 404 })
  }

  const row = coupon as CouponRow
  const result = evaluateCoupon(row, components)

  if (!result.applicable) {
    return NextResponse.json({ error: result.reason ?? 'This coupon could not be applied' }, { status: 400 })
  }

  const appliesTo = row.applies_to ?? 'both'

  return NextResponse.json({
    valid: true,
    coupon_id: row.id,
    code: row.code,
    description: row.description,
    type: row.type,
    value: row.value,
    applies_to: appliesTo,
    making_charge_discount: result.making_charge_discount,
    gem_price_discount: result.gem_price_discount,
    total_discount: result.total_discount,
  })
}
