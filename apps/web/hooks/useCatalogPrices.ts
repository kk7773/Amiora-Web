'use client'

import { useMemo } from 'react'
import { computeCatalogVariantPrice, type PriceBreakdown } from '@amiora/pricing'
import type { CatalogPurity, CatalogVariantRow } from '@/components/product/VariantSelector'
import { usePricing } from './usePricing'

export type CatalogPricingContext = {
  makingChargePct: number
  makingChargeDiscountPct: number
  gemPriceDiscountPct: number
  stoneLines: unknown
  initialGoldPerGram: number
  initialSilverPerGram: number
}

export function useCatalogPrices(
  variants: CatalogVariantRow[],
  purities: CatalogPurity[],
  ctx: CatalogPricingContext,
) {
  const { gold, silver, loading } = usePricing()

  const goldPerGram = gold?.pricePerGram ?? ctx.initialGoldPerGram
  const silverPerGram = silver?.pricePerGram ?? ctx.initialSilverPerGram

  const computedPrices = useMemo(() => {
    const map: Record<string, PriceBreakdown> = {}
    const purityById = new Map(purities.map((p) => [p.id, p]))

    for (const variant of variants) {
      if (!variant.is_active) continue
      const purity = purityById.get(variant.purity_id)
      const breakdown = computeCatalogVariantPrice({
        metalWeightG: variant.metal_weight_g,
        purityCode: purity?.code ?? '',
        metalType: purity?.metal,
        makingChargePct: ctx.makingChargePct,
        stoneLines: ctx.stoneLines,
        goldPerGram,
        silverPerGram,
        makingChargeDiscountPct: ctx.makingChargeDiscountPct,
        gemPriceDiscountPct: ctx.gemPriceDiscountPct,
      })
      if (breakdown) map[variant.id] = breakdown
    }
    return map
  }, [
    variants,
    purities,
    ctx.makingChargePct,
    ctx.makingChargeDiscountPct,
    ctx.gemPriceDiscountPct,
    ctx.stoneLines,
    goldPerGram,
    silverPerGram,
  ])

  return { computedPrices, loading, goldPerGram, silverPerGram }
}
