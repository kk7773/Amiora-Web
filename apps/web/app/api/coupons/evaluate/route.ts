import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  aggregateCartComponents,
  evaluateCoupon,
  markBestCoupons,
  sortEvaluatedCoupons,
  type CartLine,
  type CouponRow,
} from '@/lib/coupons/evaluateCoupon'

/**
 * POST /api/coupons/evaluate
 * Returns all active coupons with applicability + discount for the current cart.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { items?: CartLine[] }
    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ coupons: [] })
    }

    const supabase = await createServerClient()
    const components = await aggregateCartComponents(supabase, items)

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[POST /api/coupons/evaluate]', error)
      return NextResponse.json({ coupons: [] })
    }

    const evaluated = ((data ?? []) as CouponRow[]).map((coupon) => {
      const result = evaluateCoupon(coupon, components)
      return {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        applies_to: coupon.applies_to ?? 'both',
        min_order_amount: coupon.min_order_amount,
        max_discount_amount: coupon.max_discount_amount,
        expires_at: coupon.expires_at,
        applicable: result.applicable,
        reason: result.reason,
        total_discount: result.total_discount,
        making_charge_discount: result.making_charge_discount,
        gem_price_discount: result.gem_price_discount,
      }
    })

    const withBest = markBestCoupons(evaluated)
    const sorted = sortEvaluatedCoupons(withBest)

    return NextResponse.json({ coupons: sorted, components })
  } catch (err) {
    console.error('[POST /api/coupons/evaluate]', err)
    return NextResponse.json({ coupons: [] }, { status: 500 })
  }
}
