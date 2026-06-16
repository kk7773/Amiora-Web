import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  aggregateCartComponents,
  evaluateCoupon,
  markBestCoupons,
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

    const now = new Date()
    const activeRows = (data ?? []).filter((c) => {
      const row = c as CouponRow
      if (row.expires_at && new Date(row.expires_at) < now) return false
      if (row.usage_limit != null && row.used_count >= row.usage_limit) return false
      return true
    }) as CouponRow[]

    const evaluated = activeRows.map((coupon) => {
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

    return NextResponse.json({ coupons: withBest, components })
  } catch (err) {
    console.error('[POST /api/coupons/evaluate]', err)
    return NextResponse.json({ coupons: [] }, { status: 500 })
  }
}
