'use client'

import { useMemo } from 'react'
import { cn } from '@amiora/ui'
import { formatINR, type PriceBreakdown } from '@amiora/pricing'
import type { CatalogPurity, CatalogVariantRow } from './VariantSelector'

function formatWeightGrams(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(3)} g`
}

interface MetalPurityTableProps {
  colorId: string
  selectedPurityId: string | null
  purities: CatalogPurity[]
  variants: CatalogVariantRow[]
  computedPrices: Record<string, PriceBreakdown>
}

export function MetalPurityTable({
  colorId,
  selectedPurityId,
  purities,
  variants,
  computedPrices,
}: MetalPurityTableProps) {
  const rows = useMemo(() => {
    const activeForColor = variants.filter(
      (variant) => variant.is_active && variant.color_id === colorId,
    )
    const purityOrder = new Map(purities.map((purity, index) => [purity.id, index]))

    return activeForColor
      .map((variant) => {
        const purity = purities.find((entry) => entry.id === variant.purity_id)
        const breakdown = computedPrices[variant.id]
        return {
          variant,
          purityLabel: purity?.label ?? '—',
          breakdown,
          sortKey: purityOrder.get(variant.purity_id) ?? 999,
        }
      })
      .sort((a, b) => a.sortKey - b.sortKey || a.purityLabel.localeCompare(b.purityLabel))
  }, [colorId, purities, variants, computedPrices])

  if (rows.length === 0) {
    return <p>Metal and purity details will appear here once configured.</p>
  }

  return (
    <div className="space-y-3">
      <h4 className="font-display text-lg text-ink">Metal &amp; Purity</h4>
      <p className="text-xs text-ink-faint">
        Prices update automatically when gold/silver rates change.
      </p>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-2">
        {rows.map(({ variant, purityLabel, breakdown }) => {
          const isSelected = selectedPurityId === variant.purity_id
          return (
            <div
              key={variant.id}
              className={cn(
                'rounded-lg border border-divider bg-white p-3 space-y-2',
                isSelected && 'border-teal ring-1 ring-teal/30 bg-teal/5',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{purityLabel}</span>
                <span className="text-sm font-medium text-ink tabular-nums">
                  {breakdown ? formatINR(breakdown.finalPrice) : '—'}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div className="flex justify-between gap-2 col-span-2 sm:col-span-1">
                  <dt className="text-ink-faint">Weight</dt>
                  <dd className="text-ink tabular-nums">{formatWeightGrams(variant.metal_weight_g)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-faint">Metal</dt>
                  <dd className="text-ink tabular-nums">{breakdown ? formatINR(breakdown.baseMetalPrice) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-faint">Making</dt>
                  <dd className="text-ink tabular-nums">{breakdown ? formatINR(breakdown.makingChargeNet) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-2 col-span-2">
                  <dt className="text-ink-faint">Diamond</dt>
                  <dd className="text-ink tabular-nums">
                    {breakdown && breakdown.gemPriceNet > 0 ? formatINR(breakdown.gemPriceNet) : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[28rem]">
          <thead>
            <tr className="bg-surface">
              <th className="text-left px-3 py-2 border border-divider text-ink">Purity</th>
              <th className="text-left px-3 py-2 border border-divider text-ink">Weight</th>
              <th className="text-left px-3 py-2 border border-divider text-ink">Metal Value</th>
              <th className="text-left px-3 py-2 border border-divider text-ink">Making</th>
              <th className="text-left px-3 py-2 border border-divider text-ink">Diamond</th>
              <th className="text-left px-3 py-2 border border-divider text-ink">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ variant, purityLabel, breakdown }) => {
              const isSelected = selectedPurityId === variant.purity_id
              return (
                <tr
                  key={variant.id}
                  className={cn(
                    'bg-white transition-colors',
                    isSelected && 'bg-teal/5 ring-1 ring-inset ring-teal/30',
                  )}
                >
                  <td className="px-3 py-2 border border-divider/80 text-ink font-medium">
                    {purityLabel}
                  </td>
                  <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                    {formatWeightGrams(variant.metal_weight_g)}
                  </td>
                  <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                    {breakdown ? formatINR(breakdown.baseMetalPrice) : '—'}
                  </td>
                  <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                    {breakdown ? formatINR(breakdown.makingChargeNet) : '—'}
                  </td>
                  <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                    {breakdown && breakdown.gemPriceNet > 0
                      ? formatINR(breakdown.gemPriceNet)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums font-medium">
                    {breakdown ? formatINR(breakdown.finalPrice) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { formatWeightGrams }
