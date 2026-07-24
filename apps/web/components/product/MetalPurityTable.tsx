'use client'

import { formatINR, type PriceBreakdown } from '@amiora/pricing'
import type { CatalogPurity, CatalogVariantRow } from './VariantSelector'

function formatWeightGrams(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(3)} g`
}

type StoneInfoRow = {
  stone: string
  shape: string | null
  pieces: number | null
  totalWeight: number | null
  cut: string | null
}

function titleize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function normalizeStoneInfoRows(stoneLines: unknown): StoneInfoRow[] {
  if (!Array.isArray(stoneLines)) return []

  return stoneLines.flatMap((row, index) => {
      if (!row || typeof row !== 'object') return []
      const record = row as Record<string, unknown>
      const label =
        typeof record.stone_type === 'string' && record.stone_type.trim()
          ? record.stone_type.trim()
          : typeof record.name === 'string' && record.name.trim()
            ? record.name.trim()
            : `Stone ${index + 1}`

      const shapeRaw = record.shape
      const shape =
        typeof shapeRaw === 'string' && shapeRaw.trim()
          ? titleize(shapeRaw.trim())
          : null

      const normalizedStone = titleize(label)
      const sizes = Array.isArray(record.sizes) ? record.sizes : []

      if (sizes.length > 0) {
        return sizes
          .map((size) => {
            if (!size || typeof size !== 'object') return null
            const sizeRecord = size as Record<string, unknown>
            const piecesRaw = sizeRecord.count
            const pieces =
              typeof piecesRaw === 'number' && Number.isFinite(piecesRaw) && piecesRaw > 0
                ? piecesRaw
                : typeof piecesRaw === 'string' && piecesRaw.trim() !== '' && Number.isFinite(Number(piecesRaw))
                  ? Number(piecesRaw)
                  : null

            const weightRaw = sizeRecord.weight
            const totalWeight =
              typeof weightRaw === 'number' && Number.isFinite(weightRaw) && weightRaw > 0
                ? weightRaw
                : typeof weightRaw === 'string' && weightRaw.trim() !== '' && Number.isFinite(Number(weightRaw))
                  ? Number(weightRaw)
                  : null

            const cutRaw = sizeRecord.cut_size
            const cut =
              typeof cutRaw === 'string' && cutRaw.trim()
                ? cutRaw.trim()
                : null

            return {
              stone: normalizedStone,
              shape,
              pieces,
              totalWeight,
              cut,
            } satisfies StoneInfoRow
          })
          .filter((entry): entry is StoneInfoRow => entry != null)
      }

      const totalWeightRaw = record.total_weight
      const totalWeight =
        typeof totalWeightRaw === 'number' && Number.isFinite(totalWeightRaw) && totalWeightRaw > 0
          ? totalWeightRaw
          : null

      const piecesRaw = record.count
      const pieces =
        typeof piecesRaw === 'number' && Number.isFinite(piecesRaw) && piecesRaw > 0
          ? piecesRaw
          : typeof piecesRaw === 'string' && piecesRaw.trim() !== '' && Number.isFinite(Number(piecesRaw))
            ? Number(piecesRaw)
            : null

      const cutRaw = record.cut_size
      const cut =
        typeof cutRaw === 'string' && cutRaw.trim()
          ? cutRaw.trim()
          : null

      return [{
        stone: normalizedStone,
        shape,
        pieces,
        totalWeight,
        cut,
      } satisfies StoneInfoRow]
    })
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

  const stoneRows = normalizeStoneInfoRows(stoneLines)
  const totalStoneWeightCt = stoneRows.reduce((sum, stone) => sum + (stone.totalWeight ?? 0), 0)
  const hasStoneWeight = totalStoneWeightCt > 0

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
          <p className="text-xs uppercase tracking-widest text-ink-faint">Stone Weight</p>
          <p className="mt-1 text-base font-medium text-ink tabular-nums">{hasStoneWeight ? `${totalStoneWeightCt.toFixed(3)} ct` : '—'}</p>
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
        {stoneRows.length === 0 ? (
          <div className="rounded-lg border border-divider bg-white px-3 py-2 text-sm text-ink-muted">
            No stone details configured for this product.
          </div>
        ) : (
          <div className="space-y-4">
            {stoneRows.map((stone, index) => (
              <table key={`${stone.stone}-${stone.shape ?? 'na'}-${index}`} className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="bg-surface">
                    <th className="w-[38%] border border-divider px-4 py-3 text-left font-medium text-ink">Stone</th>
                    <td className="border border-divider px-4 py-3 text-ink font-medium">{stone.stone}</td>
                  </tr>
                  <tr className="bg-white">
                    <th className="border border-divider px-4 py-3 text-left font-medium text-ink">Shape</th>
                    <td className="border border-divider px-4 py-3 text-ink-muted">{stone.shape ?? '—'}</td>
                  </tr>
                  <tr className="bg-white">
                    <th className="border border-divider px-4 py-3 text-left font-medium text-ink">Pieces</th>
                    <td className="border border-divider px-4 py-3 text-ink tabular-nums">{stone.pieces ?? '—'}</td>
                  </tr>
                  <tr className="bg-white">
                    <th className="border border-divider px-4 py-3 text-left font-medium text-ink">Weight</th>
                    <td className="border border-divider px-4 py-3 text-ink tabular-nums">{stone.totalWeight != null ? `${stone.totalWeight.toFixed(3)} ct` : '—'}</td>
                  </tr>
                  <tr className="bg-white">
                    <th className="border border-divider px-4 py-3 text-left font-medium text-ink">Cut</th>
                    <td className="border border-divider px-4 py-3 text-ink-muted">{stone.cut ?? '—'}</td>
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { formatWeightGrams }
