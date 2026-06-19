import type { SupabaseClient } from '@supabase/supabase-js'
import {
  evaluateCoupon,
  markBestCoupons,
  sortEvaluatedCoupons,
  type CartComponents,
  type CouponRow,
} from '@/lib/coupons/evaluateCoupon'

export type EvaluatedCouponResult = {
  id: string
  code: string
  description: string | null
  type: string
  value: number
  applies_to: string
  min_order_amount: number
  max_discount_amount: number | null
  expires_at: string | null
  applicable: boolean
  reason?: string
  total_discount: number
  making_charge_discount: number
  gem_price_discount: number
  is_best: boolean
}

export async function evaluateAllCoupons(
  supabase: SupabaseClient,
  components: CartComponents,
): Promise<EvaluatedCouponResult[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[evaluateAllCoupons]', error)
    return []
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
      is_best: false,
    }
  })

  return sortEvaluatedCoupons(markBestCoupons(evaluated))
}
