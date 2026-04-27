import { calculateVariantPrice } from './calculator'

/** Variant fields used for live card price + discount badge */
export type CardVariantSlice = {
  purity: string
  weight_grams: number | null
  gem_price_override: number | null
  stock_status?: string
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?: number | null
}

export type CardProductSlice = {
  making_charge_pct: number
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?: number | null
  product_variants: CardVariantSlice[]
}

/**
 * First in-stock variant (or first row) with live price and effective % off vs undiscounted total.
 */
export function attachCardPrice<T extends CardProductSlice>(
  product: T,
  goldPerGram: number,
  silverPerGram: number
): T & { basePrice: number; discountPercentOff: number | null } {
  const v =
    product.product_variants?.find((x) => x.stock_status !== 'out_of_stock') ??
    product.product_variants?.[0]
  if (!v?.weight_grams) {
    return { ...product, basePrice: 0, discountPercentOff: null }
  }
  const live = v.purity === '92.5' ? silverPerGram : goldPerGram
  const bd = calculateVariantPrice({
    weightGrams: v.weight_grams,
    purity: v.purity,
    livePricePerGram999: live,
    makingChargePct: product.making_charge_pct,
    gemPriceOverride: v.gem_price_override,
    makingChargeDiscountPct: product.making_charge_discount_pct ?? 0,
    gemPriceDiscountPct: product.gem_price_discount_pct ?? 0,
    variantMakingChargeDiscountPct: v.making_charge_discount_pct,
    variantGemPriceDiscountPct: v.gem_price_discount_pct,
  })
  const pct = bd.percentOffGross
  return {
    ...product,
    basePrice: bd.finalPrice,
    discountPercentOff: pct >= 1 ? Math.round(pct) : null,
  }
}
