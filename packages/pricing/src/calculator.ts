/**
 * Pricing Calculator — Amiora Diamonds
 */

export type SupportedPurity = '22k' | '18k' | '14k' | '9k' | '92.5'

export const PURITY_MULTIPLIERS: Record<SupportedPurity, number> = {
  '22k':  22 / 24,
  '18k':  18 / 24,
  '14k':  14 / 24,
  '9k':    9 / 24,
  '92.5': 0.925,
}

export function parsePurityMultiplier(purity: string): number {
  const raw = purity.toLowerCase().trim()

  const known = PURITY_MULTIPLIERS[raw as SupportedPurity]
  if (known !== undefined) return known

  const karatMatch = raw.match(/^(\d+(?:\.\d+)?)\s*k(?:t|arat)?$/)
  if (karatMatch) {
    const k = parseFloat(karatMatch[1])
    if (k > 0 && k <= 24) return k / 24
  }

  const finessMatch = raw.match(/^(\d{3})$/)
  if (finessMatch) {
    const f = parseInt(finessMatch[1])
    if (f > 0 && f <= 999) return f / 1000
  }

  const pctMatch = raw.match(/^(\d+(?:\.\d+)?)\s*%$/)
  if (pctMatch) {
    const p = parseFloat(pctMatch[1])
    if (p > 0 && p <= 100) return p / 100
  }

  const decimalMatch = raw.match(/^0?\.\d+$/)
  if (decimalMatch) {
    const d = parseFloat(raw)
    if (d > 0 && d <= 1) return d
  }

  return 1
}

export interface PriceInput {
  /** Net/pure metal weight already entered for this purity row. */
  weightGrams: number
  purity: string
  livePricePerGram999: number
  makingChargePct?: number
  gemPriceOverride?: number | null
  makingChargeDiscountPct?: number
  gemPriceDiscountPct?: number
  variantMakingChargeDiscountPct?: number | null
  variantGemPriceDiscountPct?: number | null
}

export interface PriceBreakdown {
  purePrice: number
  baseMetalPrice: number
  makingCharge: number
  makingChargeDiscount: number
  makingChargeNet: number
  gemPrice: number
  gemPriceDiscount: number
  gemPriceNet: number
  productDiscount: number
  finalPrice: number
  listTotalBeforeDiscount: number
  percentOffGross: number
  currency: 'INR'
  purityMultiplier: number
}

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
  // CMS stores net/pure metal weight per purity row, so do not apply purity again.
  const baseMetalPrice = purePrice
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
