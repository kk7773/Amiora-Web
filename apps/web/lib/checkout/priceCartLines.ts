import { computeCatalogVariantPrice, resolveLiveRate } from '@amiora/pricing'
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

  const prices = await getLatestPrices().catch(() => ({ gold: null, silver: null }))
  const goldPerGram = prices.gold?.pricePerGram ?? 7200
  const silverPerGram = prices.silver?.pricePerGram ?? 90

  const productIds = [...new Set(items.map((i) => i.product_id))]
  const variantIds = [...new Set(items.map((i) => i.variant_id))]

  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, making_charge_pct, making_charge_discount_pct, gem_price_discount_pct, stone_lines')
      .in('id', productIds)
      .eq('status', 'active'),
    supabase
      .from('product_variants')
      .select('id, product_id, metal_weight_g, purity_id, is_active, stock_qty, making_charge_discount_pct, gem_price_discount_pct')
      .in('id', variantIds),
  ])

  const purityIds = [
    ...new Set((variants ?? []).map((v) => (v as VariantRow).purity_id).filter(Boolean)),
  ]

  const { data: purities } = purityIds.length > 0
    ? await supabase.from('metal_purities').select('id, code, metal').in('id', purityIds)
    : { data: [] as PurityRow[] }

  const productMap = new Map((products ?? []).map((p) => [(p as ProductRow).id, p as ProductRow]))
  const variantMap = new Map((variants ?? []).map((v) => [(v as VariantRow).id, v as VariantRow]))
  const purityMap = new Map((purities ?? []).map((p) => [(p as PurityRow).id, p as PurityRow]))

  for (const line of items) {
    const qty = clampQty(line.quantity)
    const product = productMap.get(line.product_id)
    const variant = variantMap.get(line.variant_id)

    if (!product) {
      errors.push('A product in your cart is no longer available')
      continue
    }
    if (!variant || variant.product_id !== line.product_id) {
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

    const purity = purityMap.get(variant.purity_id)
    const metalRate = resolveLiveRate(purity?.metal ?? undefined, goldPerGram, silverPerGram)

    const breakdown = computeCatalogVariantPrice({
      metalWeightG: variant.metal_weight_g,
      purityCode: purity?.code ?? '',
      metalType: purity?.metal ?? undefined,
      makingChargePct: Number(product.making_charge_pct ?? 8),
      stoneLines: product.stone_lines,
      goldPerGram,
      silverPerGram,
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

    if (!breakdown || breakdown.finalPrice <= 0) {
      errors.push(`${product.name}: price could not be calculated`)
      continue
    }

    const unitPrice = Math.round(breakdown.finalPrice)
    making += breakdown.makingChargeNet * qty
    gem += breakdown.gemPriceNet * qty

    lines.push({
      product_id: line.product_id,
      variant_id: line.variant_id,
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
