import { applyManualPriceOverride, computeCatalogVariantPrice, resolveLiveRate } from '@amiora/pricing'
import { getLatestPrices } from '@/lib/pricing/engine'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CartLine } from '@/lib/coupons/evaluateCoupon'
import type { CartComponents } from '@/lib/coupons/evaluateCoupon'

export type PricedCartLine = {
  product_id: string
  variant_id: string
  quantity: number
  unit_price: number
  line_total: number
  metal_weight_g: number | null
  metal_rate_per_gram: number | null
  in_stock: boolean
  product_name: string
}

export type PriceCartLinesResult = {
  lines: PricedCartLine[]
  components: CartComponents
  errors: string[]
}

type ProductRow = {
  id: string
  name: string
  making_charge_pct: number
  making_charge_discount_pct: number | null
  gem_price_discount_pct: number | null
  stone_lines: unknown
}

type VariantRow = {
  id: string
  product_id: string
  sku?: string | null
  price?: number | null
  metal_weight_g: number | null
  purity_id: string
  is_active: boolean
  stock_qty: number
  making_charge_discount_pct: number | null
  gem_price_discount_pct: number | null
}

type PurityRow = {
  id: string
  code: string
  metal: string | null
}

function clampQty(qty: number): number {
  return Math.max(1, Math.min(5, Number(qty) || 1))
}

function normalizeLookupKey(value?: string | null): string {
  return value?.trim().toLowerCase() ?? ''
}

export async function priceCartLines(
  supabase: SupabaseClient,
  items: CartLine[],
  options: { validateStock?: boolean } = {},
): Promise<PriceCartLinesResult> {
  const validateStock = options.validateStock ?? false
  const errors: string[] = []
  const lines: PricedCartLine[] = []
  let making = 0
  let gem = 0

  if (items.length === 0) {
    return { lines, components: { making: 0, gem: 0 }, errors }
  }

  const prices = await getLatestPrices().catch(() => ({ gold: null, silver: null, diamond: null, goldPurityRates: {} }))
  const goldPerGram = prices.gold?.pricePerGram ?? 7200
  const silverPerGram = prices.silver?.pricePerGram ?? 90
  const diamondPerCarat = prices.diamond?.pricePerGram ?? 0
  const goldPurityRates = prices.goldPurityRates ?? {}

  const requestedProductIds = [...new Set(items.map((i) => i.product_id))]
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter(Boolean))]

  const [{ data: variantsById }, { data: variantsByProduct }] = await Promise.all([
    variantIds.length > 0
      ? supabase
          .from('product_variants')
          .select('id, product_id, sku, price, metal_weight_g, purity_id, is_active, stock_qty, making_charge_discount_pct, gem_price_discount_pct')
          .in('id', variantIds)
      : Promise.resolve({ data: [] as VariantRow[] }),
    requestedProductIds.length > 0
      ? supabase
          .from('product_variants')
          .select('id, product_id, sku, price, metal_weight_g, purity_id, is_active, stock_qty, making_charge_discount_pct, gem_price_discount_pct')
          .in('product_id', requestedProductIds)
      : Promise.resolve({ data: [] as VariantRow[] }),
  ])

  const mergedVariants = [
    ...new Map(
      [...(variantsById ?? []), ...(variantsByProduct ?? [])]
        .map((variant) => [String((variant as VariantRow).id), variant as VariantRow]),
    ).values(),
  ]

  const resolvedProductIds = [
    ...new Set([
      ...requestedProductIds,
      ...mergedVariants.map((variant) => variant.product_id).filter(Boolean),
    ]),
  ]

  const { data: products } = resolvedProductIds.length > 0
    ? await supabase
        .from('products')
        .select('id, name, making_charge_pct, making_charge_discount_pct, gem_price_discount_pct, stone_lines')
        .in('id', resolvedProductIds)
        .eq('status', 'active')
    : { data: [] as ProductRow[] }

  const purityIds = [
    ...new Set(mergedVariants.map((v) => v.purity_id).filter(Boolean)),
  ]

  const { data: purities } = purityIds.length > 0
    ? await supabase.from('metal_purities').select('id, code, metal').in('id', purityIds)
    : { data: [] as PurityRow[] }

  const productMap = new Map(
    (products ?? []).map((p) => [normalizeLookupKey((p as ProductRow).id), p as ProductRow]),
  )
  const variantMap = new Map(
    mergedVariants.map((v) => [normalizeLookupKey(v.id), v] as const),
  )
  const variantSkuMap = new Map(
    mergedVariants
      .filter((v) => typeof v.sku === 'string' && v.sku.trim().length > 0)
      .map((v) => [`${normalizeLookupKey(v.product_id)}:${v.sku!.trim().toLowerCase()}`, v] as const),
  )
  const purityMap = new Map(
    (purities ?? []).map((p) => [normalizeLookupKey((p as PurityRow).id), p as PurityRow]),
  )

  for (const line of items) {
    const qty = clampQty(line.quantity)
    const variantId = normalizeLookupKey(line.variant_id)
    const variantSku = normalizeLookupKey(line.variant_sku)
    const variant =
      variantMap.get(variantId) ??
      (variantSku
      ? variantSkuMap.get(`${line.product_id}:${variantSku}`)
        : undefined) ??
      (variantId
        ? variantSkuMap.get(`${normalizeLookupKey(line.product_id)}:${variantId}`)
        : undefined)
    const resolvedProductId = variant?.product_id ?? line.product_id
    const product = productMap.get(normalizeLookupKey(resolvedProductId)) ?? productMap.get(normalizeLookupKey(line.product_id))

    if (!product) {
      errors.push('A product in your cart is no longer available')
      continue
    }
    if (!variant) {
      const snapshotPrice = Number(line.unit_price ?? 0)
      if (snapshotPrice > 0) {
        lines.push({
          product_id: line.product_id,
          variant_id: line.variant_id,
          quantity: qty,
          unit_price: Math.round(snapshotPrice),
          line_total: Math.round(snapshotPrice) * qty,
          metal_weight_g: null,
          metal_rate_per_gram: null,
          in_stock: true,
          product_name: product.name,
        })
        continue
      }

      errors.push(`${product.name}: selected option is invalid`)
      continue
    }
    if (variant.is_active === false) {
      errors.push(`${product.name}: selected option is unavailable`)
      continue
    }

    const stockQty = Number(variant.stock_qty ?? 0)
    const inStock = stockQty >= qty
    if (validateStock && !inStock) {
      errors.push(
        stockQty <= 0
          ? `${product.name} is out of stock`
          : `${product.name}: only ${stockQty} left in stock`,
      )
      continue
    }

    const purity = purityMap.get(normalizeLookupKey(variant.purity_id))
    const metalRate = resolveLiveRate(purity?.metal ?? undefined, goldPerGram, silverPerGram, purity?.code ?? '', goldPurityRates)

    const breakdown = computeCatalogVariantPrice({
      metalWeightG: variant.metal_weight_g,
      purityCode: purity?.code ?? '',
      metalType: purity?.metal ?? undefined,
      makingChargePct: Number(product.making_charge_pct ?? 8),
      stoneLines: product.stone_lines,
      goldPerGram,
      goldPurityRates,
      silverPerGram,
      diamondPricePerCarat: diamondPerCarat,
      makingChargeDiscountPct: Number(product.making_charge_discount_pct ?? 0),
      gemPriceDiscountPct: Number(product.gem_price_discount_pct ?? 0),
      variantMakingChargeDiscountPct:
        variant.making_charge_discount_pct != null
          ? Number(variant.making_charge_discount_pct)
          : null,
      variantGemPriceDiscountPct:
      variant.gem_price_discount_pct != null
          ? Number(variant.gem_price_discount_pct)
          : null,
    })
    const effectiveBreakdown = applyManualPriceOverride(breakdown, variant.price)

    if (!effectiveBreakdown || effectiveBreakdown.finalPrice <= 0) {
      errors.push(`${product.name}: price could not be calculated`)
      continue
    }

    const unitPrice = Math.round(effectiveBreakdown.finalPrice)
    making += effectiveBreakdown.makingChargeNet * qty
    gem += effectiveBreakdown.gemPriceNet * qty

    lines.push({
      product_id: resolvedProductId,
      variant_id: variant.id,
      quantity: qty,
      unit_price: unitPrice,
      line_total: unitPrice * qty,
      metal_weight_g: variant.metal_weight_g != null ? Number(variant.metal_weight_g) : null,
      metal_rate_per_gram: metalRate,
      in_stock: inStock,
      product_name: product.name,
    })
  }

  return { lines, components: { making, gem }, errors }
}
