'use client'

import { useMemo } from 'react'
import { calculateVariantPrice, type PriceBreakdown } from '@/lib/pricing/calculator'
import { usePricing } from './usePricing'

interface ProductPriceInput {
  weightGrams:       number
  purity:            string
  makingChargePct?:  number
  gemPriceOverride?: number | null
  makingChargeDiscountPct?: number
  gemPriceDiscountPct?: number
  variantMakingChargeDiscountPct?: number | null
  variantGemPriceDiscountPct?: number | null
}

interface UseProductPriceResult {
  breakdown:   PriceBreakdown | null
  loading:     boolean
  livePrice:   number | null
}

/**
 * Calculates live product price on the client.
 * Updates automatically when live gold/silver rates change via Realtime.
 */
export function useProductPrice(input: ProductPriceInput | null): UseProductPriceResult {
  const { gold, silver, loading } = usePricing()

  const breakdown = useMemo(() => {
    if (!input || loading) return null

    const isSilver          = input.purity === '92.5'
    const rate              = isSilver ? silver : gold
    const livePricePerGram  = rate?.pricePerGram ?? (isSilver ? 90 : 7200)

    return calculateVariantPrice({
      weightGrams:                    input.weightGrams,
      purity:                         input.purity,
      livePricePerGram999:            livePricePerGram,
      makingChargePct:                input.makingChargePct,
      gemPriceOverride:               input.gemPriceOverride,
      makingChargeDiscountPct:        input.makingChargeDiscountPct ?? 0,
      gemPriceDiscountPct:            input.gemPriceDiscountPct ?? 0,
      variantMakingChargeDiscountPct: input.variantMakingChargeDiscountPct,
      variantGemPriceDiscountPct:     input.variantGemPriceDiscountPct,
    })
  }, [input, gold, silver, loading])

  return {
    breakdown,
    loading,
    livePrice: breakdown?.finalPrice ?? null,
  }
}
