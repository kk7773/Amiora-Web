/** Variant slice for storefront cards — price is fixed per SKU row (catalog model). */
export type CardVariantSlice = {
  id: string
  price: number
  stock_qty: number
  is_active?: boolean
  sku?: string
}

export type CardProductSlice = {
  making_charge_pct: number
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?: number | null
  product_variants: CardVariantSlice[]
}

/**
 * First in-stock variant (or first row) using catalog variant price.
 * Gold/silver gram args retained for callers; catalog uses fixed INR `price`.
 */
export function attachCardPrice<T extends CardProductSlice>(
  product: T,
  _goldPerGram: number,
  _silverPerGram: number
): T & { basePrice: number; discountPercentOff: number | null } {
  const v =
    product.product_variants?.find(
      (x) => (x.stock_qty ?? 0) > 0 && (x.is_active ?? true),
    ) ?? product.product_variants?.[0]

  const basePrice = v ? Number(v.price ?? 0) : 0
  return {
    ...product,
    basePrice,
    discountPercentOff: null,
  }
}
