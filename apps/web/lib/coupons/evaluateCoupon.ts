import { calculateVariantPrice } from '@/lib/pricing/calculator'
import { getLatestPrices } from '@/lib/pricing/engine'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AppliesTo = 'making_charge' | 'gem_price' | 'both'

export type CartLine = { product_id: string; variant_id: string; quantity: number }

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

function resolveWeightGrams(variant: Record<string, unknown>): number | null {
  const metalWeight = variant['metal_weight_g']
  if (metalWeight != null && Number(metalWeight) > 0) return Number(metalWeight)
  const weightGrams = variant['weight_grams']
  if (weightGrams != null && Number(weightGrams) > 0) return Number(weightGrams)
  return null
}

export async function aggregateCartComponents(
  supabase: SupabaseClient,
  items: CartLine[],
): Promise<CartComponents> {
  const prices = await getLatestPrices().catch(() => ({ gold: null, silver: null }))
  const gold = prices.gold?.pricePerGram ?? 7200
  const silver = prices.silver?.pricePerGram ?? 90
  let making = 0
  let gem = 0

  for (const line of items) {
    const qty = Math.max(1, Math.min(5, Number(line.quantity) || 1))
    const { data: product } = await supabase
      .from('products')
      .select('making_charge_pct, making_charge_discount_pct, gem_price_discount_pct')
      .eq('id', line.product_id)
      .eq('is_active', true)
      .single()

    const { data: variant } = await supabase
      .from('product_variants')
      .select(
        'purity, weight_grams, metal_weight_g, gem_price_override, is_active, making_charge_discount_pct, gem_price_discount_pct',
      )
      .eq('id', line.variant_id)
      .eq('product_id', line.product_id)
      .single()

    if (!product || !variant) continue
    if ((variant as { is_active?: boolean }).is_active === false) continue

    const v = variant as Record<string, unknown>
    const p = product as Record<string, unknown>
    const wg = resolveWeightGrams(v)
    if (wg == null) continue

    const live = String(v['purity'] ?? '') === '92.5' ? silver : gold
    const variantMcDisc = v['making_charge_discount_pct']
    const variantGemDisc = v['gem_price_discount_pct']

    const breakdown = calculateVariantPrice({
      weightGrams: wg,
      purity: String(v['purity'] ?? '18k'),
      livePricePerGram999: live,
      makingChargePct: Number(p['making_charge_pct'] ?? 8),
      gemPriceOverride: v['gem_price_override'] != null ? Number(v['gem_price_override']) : null,
      makingChargeDiscountPct: Number(p['making_charge_discount_pct'] ?? 0),
      gemPriceDiscountPct: Number(p['gem_price_discount_pct'] ?? 0),
      variantMakingChargeDiscountPct:
        variantMcDisc != null ? Number(variantMcDisc) : null,
      variantGemPriceDiscountPct:
        variantGemDisc != null ? Number(variantGemDisc) : null,
    })

    making += breakdown.makingChargeNet * qty
    gem += breakdown.gemPriceNet * qty
  }

  return { making, gem }
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
