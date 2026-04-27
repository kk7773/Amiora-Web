import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { calculateVariantPrice } from '@/lib/pricing/calculator'
import { getLatestPrices } from '@/lib/pricing/engine'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * POST /api/coupons/validate
 *
 * Discount strategy: coupons apply ONLY to making charges and/or gem/stone price.
 * Never on the metal price or the overall order total.
 *
 * Request body (one of):
 *   A) code + items[] — items: { product_id, variant_id, quantity }[] (checkout cart)
 *   B) code + making_charge + gem_price — manual amounts (advanced)
 *
 * Response:
 *   valid                  boolean
 *   coupon_id              string
 *   applies_to             'making_charge' | 'gem_price' | 'both'
 *   making_charge_discount number  - discount on making charge component (INR)
 *   gem_price_discount     number  - discount on gem/stone component (INR)
 *   total_discount         number  - sum of above (INR)
 */
type CartLine = { product_id: string; variant_id: string; quantity: number }

async function aggregateCartMakingGem(
  supabase: SupabaseClient,
  items: CartLine[]
): Promise<{ making: number; gem: number }> {
  const prices  = await getLatestPrices().catch(() => ({ gold: null, silver: null }))
  const gold    = prices.gold?.pricePerGram ?? 7200
  const silver  = prices.silver?.pricePerGram ?? 90
  let making    = 0
  let gem       = 0

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
      .select('purity, weight_grams, gem_price_override, is_active')
      .eq('id', line.variant_id)
      .eq('product_id', line.product_id)
      .single()

    if (!product || !variant) continue
    if ((variant as { is_active?: boolean }).is_active === false) continue
    const v  = variant as Record<string, unknown>
    const p  = product as Record<string, unknown>
    const wg = v['weight_grams']
    if (wg == null || Number(wg) <= 0) continue

    const live     = String(v['purity'] ?? '') === '92.5' ? silver : gold
    const breakdown = calculateVariantPrice({
      weightGrams:                    Number(wg),
      purity:                         String(v['purity'] ?? '18k'),
      livePricePerGram999:            live,
      makingChargePct:                Number(p['making_charge_pct'] ?? 8),
      gemPriceOverride:               v['gem_price_override'] != null ? Number(v['gem_price_override']) : null,
      makingChargeDiscountPct:        Number(p['making_charge_discount_pct'] ?? 0),
      gemPriceDiscountPct:            Number(p['gem_price_discount_pct'] ?? 0),
    })

    making += breakdown.makingChargeNet * qty
    gem    += breakdown.gemPriceNet * qty
  }

  return { making, gem }
}

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

  let making_charge = Number(body.making_charge ?? 0)
  let gem_price     = Number(body.gem_price ?? 0)

  if (Array.isArray(items) && items.length > 0) {
    const { making, gem } = await aggregateCartMakingGem(supabase, items)
    making_charge = making
    gem_price     = gem
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

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 })
  }

  // Check usage limit
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 400 })
  }

  // Determine the discountable base according to applies_to
  const appliesTo: 'making_charge' | 'gem_price' | 'both' = coupon.applies_to ?? 'both'
  const mc = Number(making_charge ?? 0)
  const gp = Number(gem_price    ?? 0)

  // Check minimum order amount against the discountable base
  const discountableBase =
    appliesTo === 'making_charge' ? mc
    : appliesTo === 'gem_price'   ? gp
    : mc + gp

  if (coupon.min_order_amount > 0 && discountableBase < coupon.min_order_amount) {
    return NextResponse.json({
      error: `This coupon requires a minimum ${
        appliesTo === 'making_charge' ? 'making charge' :
        appliesTo === 'gem_price'     ? 'stone/gem value' :
        'making charge + stone value'
      } of ₹${coupon.min_order_amount}`,
    }, { status: 400 })
  }

  // Calculate per-component discounts
  function componentDiscount(base: number): number {
    if (coupon.type === 'percentage') {
      const d = base * (coupon.value / 100)
      return coupon.max_discount_amount ? Math.min(d, coupon.max_discount_amount) : d
    }
    // Fixed: split proportionally if applies to both, otherwise all to target
    return Math.min(coupon.value, base)
  }

  let making_charge_discount = 0
  let gem_price_discount     = 0

  if (appliesTo === 'making_charge') {
    making_charge_discount = componentDiscount(mc)
  } else if (appliesTo === 'gem_price') {
    gem_price_discount = componentDiscount(gp)
  } else {
    // 'both' — for percentage apply rate to each; for fixed split proportionally
    if (coupon.type === 'percentage') {
      making_charge_discount = componentDiscount(mc)
      gem_price_discount     = componentDiscount(gp)
      // Re-apply overall max_discount_amount cap across both if set
      if (coupon.max_discount_amount) {
        const total = making_charge_discount + gem_price_discount
        if (total > coupon.max_discount_amount) {
          const ratio = coupon.max_discount_amount / total
          making_charge_discount *= ratio
          gem_price_discount     *= ratio
        }
      }
    } else {
      // Fixed amount: split proportionally by component size
      const total = mc + gp
      if (total > 0) {
        making_charge_discount = Math.min(coupon.value, total) * (mc / total)
        gem_price_discount     = Math.min(coupon.value, total) * (gp / total)
      }
    }
  }

  making_charge_discount = Math.round(making_charge_discount)
  gem_price_discount     = Math.round(gem_price_discount)
  const total_discount   = making_charge_discount + gem_price_discount

  return NextResponse.json({
    valid:                  true,
    coupon_id:              coupon.id,
    code:                   coupon.code,
    description:            coupon.description,
    type:                   coupon.type,
    value:                  coupon.value,
    applies_to:             appliesTo,
    making_charge_discount,
    gem_price_discount,
    total_discount,
  })
}
