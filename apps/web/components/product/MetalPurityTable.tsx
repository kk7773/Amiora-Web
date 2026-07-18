'use client'

import { formatINR, type PriceBreakdown } from '@amiora/pricing'
import type { CatalogPurity, CatalogVariantRow } from './VariantSelector'

function formatWeightGrams(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(3)} g`
}

function purityMultiplier(code: string | null | undefined): number | null {
  const normalized = (code ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === '22' || normalized === '22k' || normalized === '22kt') return 22 / 24
  if (normalized === '18' || normalized === '18k' || normalized === '18kt') return 18 / 24
  if (normalized === '14' || normalized === '14k' || normalized === '14kt') return 14 / 24
  if (normalized === '09' || normalized === '9' || normalized === '9k' || normalized === '9kt') return 9 / 24
  if (normalized === '925' || normalized === '92.5') return 0.925
  if (normalized === '835') return 0.835
  return null
}

function formatStoneValue(value: number): string {
  return value > 0 ? formatINR(value) : '—'
}

type StoneLineSummary = {
  label: string
  totalWeight: number | null
  totalPrice: number | null
}

function summarizeStoneLines(stoneLines: unknown): StoneLineSummary[] {
  if (!Array.isArray(stoneLines)) return []

  return stoneLines
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null
      const record = row as Record<string, unknown>
      const label =
        typeof record.stone_type === 'string' && record.stone_type.trim()
          ? record.stone_type.trim()
          : typeof record.name === 'string' && record.name.trim()
            ? record.name.trim()
            : `Stone ${index + 1}`

      const totalWeightRaw = record.total_weight
      const totalWeight =
        typeof totalWeightRaw === 'number' && Number.isFinite(totalWeightRaw) && totalWeightRaw > 0
          ? totalWeightRaw
          : null

      const totalPriceRaw = record.price_inr
      const totalPrice =
        typeof totalPriceRaw === 'number' && Number.isFinite(totalPriceRaw) && totalPriceRaw > 0
          ? totalPriceRaw
          : null

      return {
        label: label.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        totalWeight,
        totalPrice,
      }
    })
    .filter((row): row is StoneLineSummary => row != null)
}

interface MetalPurityTableProps {
  selectedVariant: CatalogVariantRow | null
  selectedPurity: CatalogPurity | null
  breakdown: PriceBreakdown | null
  stoneLines: unknown
}

export function MetalPurityTable({
  selectedVariant,
  selectedPurity,
  breakdown,
  stoneLines,
}: MetalPurityTableProps) {
  if (!selectedVariant || !selectedPurity) {
    return <p>Select a variant to see metal, weight, and stone details.</p>
  }

  const multiplier = purityMultiplier(selectedPurity.code)
  const grossWeight =
    selectedVariant.metal_weight_g != null &&
    Number.isFinite(Number(selectedVariant.metal_weight_g)) &&
    multiplier != null &&
    multiplier > 0
      ? Number(selectedVariant.metal_weight_g) / multiplier
      : null
  const stoneSummary = summarizeStoneLines(stoneLines)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {/* <h4 className="font-display text-lg text-ink"></h4>
        <p className="text-xs text-ink-faint">
          Yeh details sirf abhi selected variant ke liye hain.
        </p> */}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-divider bg-white p-3">
          <p className="text-xs uppercase tracking-widest text-ink-faint">Purity</p>
          <p className="mt-1 text-base font-medium text-ink">{selectedPurity.label}</p>
        </div>
        <div className="rounded-lg border border-divider bg-white p-3">
          <p className="text-xs uppercase tracking-widest text-ink-faint">Net Metal Weight</p>
          <p className="mt-1 text-base font-medium text-ink tabular-nums">{formatWeightGrams(selectedVariant.metal_weight_g)}</p>
        </div>
        <div className="rounded-lg border border-divider bg-white p-3">
          <p className="text-xs uppercase tracking-widest text-ink-faint">Gross Weight</p>
          <p className="mt-1 text-base font-medium text-ink tabular-nums">{formatWeightGrams(grossWeight)}</p>
        </div>
        <div className="rounded-lg border border-divider bg-white p-3">
          <p className="text-xs uppercase tracking-widest text-ink-faint">Total Price</p>
          <p className="mt-1 text-base font-medium text-ink tabular-nums">{breakdown ? formatINR(breakdown.finalPrice) : '—'}</p>
        </div>
      </div>

      {/* <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[24rem]">
          <thead>
            <tr className="bg-surface">
              <th className="text-left px-3 py-2 border border-divider text-ink">Particulars</th>
              <th className="text-left px-3 py-2 border border-divider text-ink">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-3 py-2 border border-divider/80 text-ink font-medium">Metal Value</td>
              <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                {breakdown ? formatINR(breakdown.baseMetalPrice) : '—'}
              </td>
            </tr>
            <tr className="bg-white">
              <td className="px-3 py-2 border border-divider/80 text-ink font-medium">Making Charge</td>
              <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                {breakdown ? formatINR(breakdown.makingChargeNet) : '—'}
              </td>
            </tr>
            <tr className="bg-white">
              <td className="px-3 py-2 border border-divider/80 text-ink font-medium">Stone Value</td>
              <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                {breakdown ? formatStoneValue(breakdown.gemPriceNet) : '—'}
              </td>
            </tr>
            <tr className="bg-white">
              <td className="px-3 py-2 border border-divider/80 text-ink font-medium">Variant Total</td>
              <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums font-medium">
                {breakdown ? formatINR(breakdown.finalPrice) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div> */}

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-ink">Stone Info</h5>
        {stoneSummary.length === 0 ? (
          <div className="rounded-lg border border-divider bg-white px-3 py-2 text-sm text-ink-muted">
            No stone details configured for this product.
          </div>
        ) : (
          <div className="space-y-2">
            {stoneSummary.map((stone) => (
              <div key={`${stone.label}-${stone.totalWeight ?? 0}-${stone.totalPrice ?? 0}`} className="rounded-lg border border-divider bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{stone.label}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
                    <span>Total weight: <span className="text-ink tabular-nums">{stone.totalWeight != null ? `${stone.totalWeight.toFixed(3)} ct` : '—'}</span></span>
                    <span>Total value: <span className="text-ink tabular-nums">{stone.totalPrice != null ? formatINR(stone.totalPrice) : '—'}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { formatWeightGrams }
