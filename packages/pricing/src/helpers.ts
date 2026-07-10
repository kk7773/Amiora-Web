import { calculateVariantPrice, type PriceBreakdown } from './calculator'

export type MetalType = 'gold' | 'silver' | 'platinum' | string

const DEFAULT_GOLD_PER_GRAM   = 7200
const DEFAULT_SILVER_PER_GRAM = 90

/** Map metal_purities.code from DB to calculator purity string. */
export function purityCodeToCalcInput(code: string, metal?: MetalType): string {
  const c = code.trim()
  if (!c) return metal === 'silver' ? '925' : '18k'

  if (/^\d{3}$/.test(c)) return c

  const karat = parseInt(c, 10)
  if (Number.isFinite(karat) && karat > 0 && karat <= 24) {
    return `${karat}k`
  }

  return c
}

export function resolveLiveRate(
  metal: MetalType | undefined,
  goldPerGram: number | null | undefined,
  silverPerGram: number | null | undefined,
): number {
  const isSilver = (metal ?? '').toLowerCase() === 'silver'
  if (isSilver) {
    return silverPerGram != null && Number.isFinite(silverPerGram) && silverPerGram > 0
      ? silverPerGram
      : DEFAULT_SILVER_PER_GRAM
  }
  return goldPerGram != null && Number.isFinite(goldPerGram) && goldPerGram > 0
    ? goldPerGram
    : DEFAULT_GOLD_PER_GRAM
}

/** Sum fixed diamond/gem price from product stone_lines JSON. */
export function sumStoneLinesPrice(stoneLines: unknown, diamondPricePerCarat = 0): number {
  if (!Array.isArray(stoneLines)) return 0
  let total = 0
  for (const row of stoneLines) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const sizes = record.sizes
    if (Array.isArray(sizes)) {
      for (const size of sizes) {
        if (!size || typeof size !== 'object') continue
        const sizeRecord = size as Record<string, unknown>
        const price = sizeRecord.price_inr
        if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
          total += price
          continue
        }
        const pricePerCarat = sizeRecord.price_per_carat_inr
        const weight = sizeRecord.weight
        if (
          typeof pricePerCarat === 'number' &&
          Number.isFinite(pricePerCarat) &&
          pricePerCarat > 0 &&
          typeof weight === 'number' &&
          Number.isFinite(weight) &&
          weight > 0
        ) {
          total += pricePerCarat * weight
          continue
        }
        if (
          diamondPricePerCarat > 0 &&
          typeof weight === 'number' &&
          Number.isFinite(weight) &&
          weight > 0
        ) {
          total += diamondPricePerCarat * weight
          continue
        }
        const rate = sizeRecord.rate_inr
        const count = sizeRecord.count
        if (
          typeof rate === 'number' &&
          Number.isFinite(rate) &&
          rate > 0 &&
          typeof count === 'number' &&
          Number.isFinite(count) &&
          count > 0
        ) {
          total += rate * count
        }
      }
      continue
    }
    const price = record.price_inr
    if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
      total += price
      continue
    }
    const pricePerCarat = record.price_per_carat_inr
    const weight = record.weight
    if (
      typeof pricePerCarat === 'number' &&
      Number.isFinite(pricePerCarat) &&
      pricePerCarat > 0 &&
      typeof weight === 'number' &&
      Number.isFinite(weight) &&
      weight > 0
    ) {
      total += pricePerCarat * weight
      continue
    }
    if (
      diamondPricePerCarat > 0 &&
      typeof weight === 'number' &&
      Number.isFinite(weight) &&
      weight > 0
    ) {
      total += diamondPricePerCarat * weight
      continue
    }
    const totalWeight = record.total_weight
    if (
      diamondPricePerCarat > 0 &&
      typeof totalWeight === 'number' &&
      Number.isFinite(totalWeight) &&
      totalWeight > 0
    ) {
      total += diamondPricePerCarat * totalWeight
      continue
    }
    const rate = record.rate_inr
    const count = record.count
    if (
      typeof rate === 'number' &&
      Number.isFinite(rate) &&
      rate > 0 &&
      typeof count === 'number' &&
      Number.isFinite(count) &&
      count > 0
    ) {
      total += rate * count
    }
  }
  return Math.round(total * 100) / 100
}

export interface ComputeCatalogVariantInput {
  metalWeightG: number | null | undefined
  purityCode: string
  metalType?: MetalType
  makingChargePct?: number
  stoneLines?: unknown
  goldPerGram: number | null | undefined
  silverPerGram: number | null | undefined
  diamondPricePerCarat?: number | null | undefined
  makingChargeDiscountPct?: number
  gemPriceDiscountPct?: number
  variantMakingChargeDiscountPct?: number | null
  variantGemPriceDiscountPct?: number | null
}

export function computeCatalogVariantPrice(input: ComputeCatalogVariantInput): PriceBreakdown | null {
  const weight = input.metalWeightG
  if (weight == null || !Number.isFinite(weight) || weight <= 0) return null

  const liveRate = resolveLiveRate(input.metalType, input.goldPerGram, input.silverPerGram)
  const purity = purityCodeToCalcInput(input.purityCode, input.metalType)
  const gemTotal = sumStoneLinesPrice(input.stoneLines, input.diamondPricePerCarat ?? 0)

  return calculateVariantPrice({
    weightGrams: weight,
    purity,
    livePricePerGram999: liveRate,
    makingChargePct: input.makingChargePct ?? 8,
    gemPriceOverride: gemTotal > 0 ? gemTotal : null,
    makingChargeDiscountPct: input.makingChargeDiscountPct ?? 0,
    gemPriceDiscountPct: input.gemPriceDiscountPct ?? 0,
    variantMakingChargeDiscountPct: input.variantMakingChargeDiscountPct,
    variantGemPriceDiscountPct: input.variantGemPriceDiscountPct,
  })
}

export function readManualPriceOverride(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
}

export function applyManualPriceOverride(
  breakdown: PriceBreakdown | null,
  manualPrice: number | null | undefined,
): PriceBreakdown | null {
  const override = readManualPriceOverride(manualPrice)
  if (override == null) return breakdown

  if (!breakdown) {
    return {
      purePrice: 0,
      baseMetalPrice: 0,
      makingCharge: 0,
      makingChargeDiscount: 0,
      makingChargeNet: 0,
      gemPrice: 0,
      gemPriceDiscount: 0,
      gemPriceNet: 0,
      productDiscount: 0,
      finalPrice: override,
      listTotalBeforeDiscount: override,
      percentOffGross: 0,
      purityMultiplier: 0,
      currency: 'INR',
    }
  }

  return {
    ...breakdown,
    finalPrice: override,
    listTotalBeforeDiscount: override,
    percentOffGross: 0,
  }
}

/** Build price breakup rows for PDP table display. */
export function breakdownToDisplayRows(
  breakdown: PriceBreakdown,
  makingChargePct: number,
): Array<{ label: string; amount: number }> {
  const rows: Array<{ label: string; amount: number }> = [
    { label: 'Metal value', amount: breakdown.baseMetalPrice },
    { label: `Making charge (${makingChargePct}%)`, amount: breakdown.makingChargeNet },
  ]
  if (breakdown.gemPriceNet > 0) {
    rows.push({ label: 'Diamond / stone', amount: breakdown.gemPriceNet })
  }
  rows.push({ label: 'Total', amount: breakdown.finalPrice })
  return rows
}
