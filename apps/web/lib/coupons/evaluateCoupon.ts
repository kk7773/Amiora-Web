import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppliesTo } from '@/lib/coupons/constants'
import { priceCartLines } from '@/lib/checkout/priceCartLines'
export type { AppliesTo } from '@/lib/coupons/constants'
export { APPLIES_TO_LABELS } from '@/lib/coupons/constants'

export type CartLine = {
  product_id: string
  variant_id: string
  quantity: number
  variant_sku?: string | null
  unit_price?: number | null
}

export type CouponRow = {
  id: string
  code: string
  description: string | null
  type: 'percentage' | 'fixed'
  value: number
  applies_to: AppliesTo
  min_order_amount: number
  max_discount_amount: number | null
  usage_limit: number | null
  used_count: number
  expires_at: string | null
  is_active: boolean
}

export type CartComponents = { making: number; gem: number }

export type CouponEvaluation = {
  applicable: boolean
  reason?: string
  making_charge_discount: number
  gem_price_discount: number
  total_discount: number
}

export async function aggregateCartComponents(
  supabase: SupabaseClient,
  items: CartLine[],
): Promise<CartComponents> {
  const { components } = await priceCartLines(supabase, items, { validateStock: false })
  return components
}
export function isCouponActive(coupon: CouponRow, now = new Date()): boolean {
  if (!coupon.is_active) return false
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return false
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return false
  return true
}

export function evaluateCoupon(
  coupon: CouponRow,
  components: CartComponents,
): CouponEvaluation {
  const empty: CouponEvaluation = {
    applicable: false,
    making_charge_discount: 0,
    gem_price_discount: 0,
    total_discount: 0,
  }

  if (!isCouponActive(coupon)) {
    return { ...empty, reason: 'This coupon is no longer available' }
  }

  const appliesTo: AppliesTo = coupon.applies_to ?? 'both'
  const mc = components.making
  const gp = components.gem

  if (appliesTo === 'gem_price' && gp <= 0) {
    return { ...empty, reason: 'No diamond/stone items in cart' }
  }
  if (appliesTo === 'making_charge' && mc <= 0) {
    return { ...empty, reason: 'No making charge in cart' }
  }
  if (appliesTo === 'both' && mc + gp <= 0) {
    return { ...empty, reason: 'Cart has no discountable components' }
  }

  const discountableBase =
    appliesTo === 'making_charge' ? mc
    : appliesTo === 'gem_price' ? gp
    : mc + gp

  if (coupon.min_order_amount > 0 && discountableBase < coupon.min_order_amount) {
    const label =
      appliesTo === 'making_charge' ? 'making charge'
      : appliesTo === 'gem_price' ? 'diamond/stone value'
      : 'making charge + diamond/stone value'
    return {
      ...empty,
      reason: `Requires minimum ${label} of ₹${coupon.min_order_amount}`,
    }
  }

  function componentDiscount(base: number): number {
    if (coupon.type === 'percentage') {
      const d = base * (coupon.value / 100)
      return coupon.max_discount_amount != null ? Math.min(d, coupon.max_discount_amount) : d
    }
    return Math.min(coupon.value, base)
  }

  let making_charge_discount = 0
  let gem_price_discount = 0

  if (appliesTo === 'making_charge') {
    making_charge_discount = componentDiscount(mc)
  } else if (appliesTo === 'gem_price') {
    gem_price_discount = componentDiscount(gp)
  } else if (coupon.type === 'percentage') {
    making_charge_discount = componentDiscount(mc)
    gem_price_discount = componentDiscount(gp)
    if (coupon.max_discount_amount != null) {
      const total = making_charge_discount + gem_price_discount
      if (total > coupon.max_discount_amount) {
        const ratio = coupon.max_discount_amount / total
        making_charge_discount *= ratio
        gem_price_discount *= ratio
      }
    }
  } else {
    const total = mc + gp
    if (total > 0) {
      const capped = Math.min(coupon.value, total)
      making_charge_discount = capped * (mc / total)
      gem_price_discount = capped * (gp / total)
    }
  }

  making_charge_discount = Math.round(making_charge_discount)
  gem_price_discount = Math.round(gem_price_discount)
  const total_discount = making_charge_discount + gem_price_discount

  if (total_discount <= 0) {
    return { ...empty, reason: 'This coupon does not apply to your cart' }
  }

  return {
    applicable: true,
    making_charge_discount,
    gem_price_discount,
    total_discount,
  }
}

export function markBestCoupons<T extends { applicable: boolean; total_discount: number; code: string }>(
  coupons: T[],
): (T & { is_best: boolean })[] {
  const applicable = coupons.filter((c) => c.applicable && c.total_discount > 0)
  const maxDiscount = applicable.length > 0
    ? Math.max(...applicable.map((c) => c.total_discount))
    : 0

  return coupons.map((c) => ({
    ...c,
    is_best: c.applicable && c.total_discount > 0 && c.total_discount === maxDiscount,
  }))
}

/** Applicable coupons first (highest savings on top), then inapplicable by code. */
export function sortEvaluatedCoupons<T extends { applicable: boolean; total_discount: number; code: string }>(
  coupons: T[],
): T[] {
  return [...coupons].sort((a, b) => {
    const aOk = a.applicable && a.total_discount > 0
    const bOk = b.applicable && b.total_discount > 0
    if (aOk !== bOk) return aOk ? -1 : 1
    if (aOk && bOk && a.total_discount !== b.total_discount) {
      return b.total_discount - a.total_discount
    }
    return a.code.localeCompare(b.code)
  })
}
