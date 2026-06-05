import { computeCatalogVariantPrice } from '@amiora/pricing'

export type PurityMeta = { code: string; metal?: string }

export type CardVariantSlice = {
  id: string
  price?: number
  stock_qty: number
  is_active?: boolean
  sku?: string
  metal_weight_g?: number | null
  purity_id?: string
}

export type CardProductSlice = {
  making_charge_pct: number
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?: number | null
  stone_lines?: unknown
  product_variants: CardVariantSlice[]
}

/**
 * Compute live "From ₹X" using weight × today's metal rate + making % + fixed stones.
 */
export function attachCardPrice<T extends CardProductSlice>(
  product: T,
  goldPerGram: number,
  silverPerGram: number,
  purityMap: Record<string, PurityMeta> = {},
): T & { basePrice: number; discountPercentOff: number | null } {
  let minPrice = Infinity
  let bestPercentOff = 0

  for (const variant of product.product_variants ?? []) {
    if (!(variant.is_active ?? true)) continue

    const purity = variant.purity_id ? purityMap[variant.purity_id] : undefined
    const breakdown = computeCatalogVariantPrice({
      metalWeightG: variant.metal_weight_g,
      purityCode: purity?.code ?? '',
      metalType: purity?.metal,
      makingChargePct: product.making_charge_pct,
      stoneLines: product.stone_lines,
      goldPerGram,
      silverPerGram,
      makingChargeDiscountPct: product.making_charge_discount_pct ?? 0,
      gemPriceDiscountPct: product.gem_price_discount_pct ?? 0,
    })

    if (!breakdown || breakdown.finalPrice <= 0) continue
    if (breakdown.finalPrice < minPrice) {
      minPrice = breakdown.finalPrice
      bestPercentOff = breakdown.percentOffGross
    }
  }

  const basePrice = minPrice === Infinity ? 0 : Math.round(minPrice)
  return {
    ...product,
    basePrice,
    discountPercentOff: bestPercentOff > 0 ? bestPercentOff : null,
  }
}
