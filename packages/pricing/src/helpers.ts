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
export function sumStoneLinesPrice(stoneLines: unknown): number {
  if (!Array.isArray(stoneLines)) return 0
  let total = 0
  for (const row of stoneLines) {
    if (!row || typeof row !== 'object') continue
    const price = (row as Record<string, unknown>).price_inr
    if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
      total += price
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
  const gemTotal = sumStoneLinesPrice(input.stoneLines)

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
