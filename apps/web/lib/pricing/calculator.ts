/**
 * Pricing Calculator — Amiora Diamonds
 *
 * Formula (from SESSION_02_API_SETUP.md):
 *   pure_price       = weight_grams × live_price_per_gram_999
 *   base_metal_price = pure_price × purity_multiplier
 *   making_charge    = base_metal_price × (making_charge_pct / 100)
 *   gem_price        = variant.gem_price_override ?? 0
 *   final_price      = base_metal_price + making_charge + gem_price
 *
 * All prices in INR, rounded to 2 decimal places.
 */

export type SupportedPurity = '22k' | '18k' | '14k' | '9k' | '92.5'

/** Ratio of pure metal content per purity grade */
export const PURITY_MULTIPLIERS: Record<SupportedPurity, number> = {
  '22k':  22 / 24,   // 0.9167
  '18k':  18 / 24,   // 0.7500
  '14k':  14 / 24,   // 0.5833
  '9k':    9 / 24,   // 0.3750
  '92.5': 0.925,     // Sterling Silver
}

/**
 * Smart purity parser — handles custom purities like:
 * "9kt", "9K", "21k", "750", "585", "375", "0.75", "99.9%" etc.
 * Returns a multiplier between 0 and 1.
 */
export function parsePurityMultiplier(purity: string): number {
  const raw = purity.toLowerCase().trim()

  // Standard lookup first
  const known = PURITY_MULTIPLIERS[raw as SupportedPurity]
  if (known !== undefined) return known

  // Strip 'k', 'kt', 'karat' suffix → karat gold  e.g. "9kt" → 9/24
  const karatMatch = raw.match(/^(\d+(?:\.\d+)?)\s*k(?:t|arat)?$/)
  if (karatMatch) {
    const k = parseFloat(karatMatch[1])
    if (k > 0 && k <= 24) return k / 24
  }

  // Millesimal fineness (3-digit): 999, 750, 585, 375 etc.
  const finessMatch = raw.match(/^(\d{3})$/)
  if (finessMatch) {
    const f = parseInt(finessMatch[1])
    if (f > 0 && f <= 999) return f / 1000
  }

  // Percentage: "92.5%", "99.9%" → divide by 100
  const pctMatch = raw.match(/^(\d+(?:\.\d+)?)\s*%$/)
  if (pctMatch) {
    const p = parseFloat(pctMatch[1])
    if (p > 0 && p <= 100) return p / 100
  }

  // Plain decimal: "0.75", "0.925"
  const decimalMatch = raw.match(/^0?\.\d+$/)
  if (decimalMatch) {
    const d = parseFloat(raw)
    if (d > 0 && d <= 1) return d
  }

  // Fallback — return 1 (pure) so price is not broken
  return 1
}

export interface PriceInput {
  /** Gross metal weight in grams */
  weightGrams: number
  /** Purity grade of the metal */
  purity: string
  /** Live 999-purity price per gram (INR) from live_prices table */
  livePricePerGram999: number
  /** Making charge percentage from products.making_charge_pct (default 8) */
  makingChargePct?: number
  /** Fixed gem/diamond price from product_variants.gem_price_override */
  gemPriceOverride?: number | null
  /**
   * Permanent product-level discount on making charges (0–100 %).
   * Set from products.making_charge_discount_pct.
   */
  makingChargeDiscountPct?: number
  /**
   * Permanent product-level discount on gem/stone price (0–100 %).
   * Set from products.gem_price_discount_pct.
   */
  gemPriceDiscountPct?: number
  /**
   * When set (0–100), overrides product making-charge discount for this variant only.
   * NULL/undefined = use product-level `makingChargeDiscountPct`.
   */
  variantMakingChargeDiscountPct?: number | null
  /**
   * When set (0–100), overrides product gem discount for this variant only.
   * NULL/undefined = use product-level `gemPriceDiscountPct`.
   */
  variantGemPriceDiscountPct?: number | null
}

export interface PriceBreakdown {
  purePrice: number
  baseMetalPrice: number
  /** Making charge before any discount */
  makingCharge: number
  /** Discount applied to making charge (product-level) */
  makingChargeDiscount: number
  /** Net making charge after product-level discount */
  makingChargeNet: number
  /** Gem/stone price before any discount */
  gemPrice: number
  /** Discount applied to gem/stone price (product-level) */
  gemPriceDiscount: number
  /** Net gem/stone price after product-level discount */
  gemPriceNet: number
  /** Total product-level discount (making + gem) */
  productDiscount: number
  finalPrice: number
  /**
   * Metal + gross making + gross gem (before any component discount).
   * Used to express “% off” relative to the headline total.
   */
  listTotalBeforeDiscount: number
  /**
   * Effective % saved vs `listTotalBeforeDiscount` (0–100). 0 when no discount.
   */
  percentOffGross: number
  currency: 'INR'
  /** Purity multiplier used (for display/audit) */
  purityMultiplier: number
}

/**
 * Calculate the final price for a single product variant.
 *
 * Discount strategy: discounts apply ONLY to making charges and/or gem price —
 * never to the metal price itself. Product-level discounts are permanent
 * (always shown). Coupon discounts are applied separately at checkout.
 */
export function calculateVariantPrice(input: PriceInput): PriceBreakdown {
  const {
    weightGrams,
    purity,
    livePricePerGram999,
    makingChargePct          = 8,
    gemPriceOverride         = null,
    makingChargeDiscountPct  = 0,
    gemPriceDiscountPct      = 0,
    variantMakingChargeDiscountPct,
    variantGemPriceDiscountPct,
  } = input

  const effMakingDiscPct =
    variantMakingChargeDiscountPct != null && !Number.isNaN(variantMakingChargeDiscountPct)
      ? variantMakingChargeDiscountPct
      : makingChargeDiscountPct
  const effGemDiscPct =
    variantGemPriceDiscountPct != null && !Number.isNaN(variantGemPriceDiscountPct)
      ? variantGemPriceDiscountPct
      : gemPriceDiscountPct

  const purityMultiplier = parsePurityMultiplier(purity)

  const purePrice      = weightGrams * livePricePerGram999
  const baseMetalPrice = purePrice * purityMultiplier
  const makingCharge   = baseMetalPrice * (makingChargePct / 100)
  const gemPrice       = gemPriceOverride ?? 0

  const makingChargeDiscount = round2(makingCharge * (effMakingDiscPct / 100))
  const gemPriceDiscount     = round2(gemPrice     * (effGemDiscPct     / 100))
  const makingChargeNet      = round2(makingCharge - makingChargeDiscount)
  const gemPriceNet          = round2(gemPrice     - gemPriceDiscount)
  const productDiscount      = round2(makingChargeDiscount + gemPriceDiscount)
  const finalPrice           = round2(baseMetalPrice + makingChargeNet + gemPriceNet)
  const listTotalBeforeDiscount = round2(baseMetalPrice + makingCharge + gemPrice)
  const savedVsList          = round2(listTotalBeforeDiscount - finalPrice)
  const percentOffGross =
    listTotalBeforeDiscount > 0 && savedVsList > 0
      ? round2(Math.min(100, (100 * savedVsList) / listTotalBeforeDiscount))
      : 0

  return {
    purePrice:            round2(purePrice),
    baseMetalPrice:       round2(baseMetalPrice),
    makingCharge:         round2(makingCharge),
    makingChargeDiscount,
    makingChargeNet,
    gemPrice:             round2(gemPrice),
    gemPriceDiscount,
    gemPriceNet,
    productDiscount,
    finalPrice,
    listTotalBeforeDiscount,
    percentOffGross,
    purityMultiplier,
    currency: 'INR',
  }
}

/**
 * Apply a coupon discount to the discountable price components.
 * Returns the coupon discount amount in INR.
 *
 * @param appliesTo  - 'making_charge' | 'gem_price' | 'both'
 * @param type       - 'percentage' | 'fixed'
 * @param value      - percentage (0–100) or fixed INR amount
 * @param breakdown  - result of calculateVariantPrice (net values after product discounts)
 * @param maxDiscount - optional cap in INR for percentage coupons
 */
export function applyCouponDiscount(params: {
  appliesTo:   'making_charge' | 'gem_price' | 'both'
  type:        'percentage' | 'fixed'
  value:       number
  breakdown:   PriceBreakdown
  maxDiscount?: number | null
}): number {
  const { appliesTo, type, value, breakdown, maxDiscount } = params

  let base = 0
  if (appliesTo === 'making_charge') base = breakdown.makingChargeNet
  else if (appliesTo === 'gem_price') base = breakdown.gemPriceNet
  else base = breakdown.makingChargeNet + breakdown.gemPriceNet

  let discount = 0
  if (type === 'percentage') {
    discount = base * (value / 100)
    if (maxDiscount) discount = Math.min(discount, maxDiscount)
  } else {
    discount = Math.min(value, base)
  }

  return Math.round(discount)
}

/** Format INR price for display */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
