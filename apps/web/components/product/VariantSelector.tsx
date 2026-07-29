'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@amiora/ui'

export type CatalogColorGroup = {
  colorId: string
  code:    string
  label:   string
  hex:     string | null
  images:  string[]
  videos?: string[]
}

export type CatalogPurity = {
  id:             string
  code:           string
  label:          string
  display_order:  number
  metal?:         string
}

export type CatalogVariantRow = {
  id:           string
  color_id:     string
  purity_id:    string
  sku:          string
  price:        number
  stock_qty:    number
  metal_weight_g?: number | null
  is_active:    boolean
  price_breakup?: unknown
}

export interface SelectedVariantState {
  variantId: string | null
  sizeLabel: string | null
  quantity:  number
  colorId:   string
}

interface VariantSelectorProps {
  colorGroups: CatalogColorGroup[]
  purities:    CatalogPurity[]
  variants:    CatalogVariantRow[]
  sizeOptions?: string[]
  sizeStockMap?: Record<string, number>
  onChange:    (state: SelectedVariantState & { variant: CatalogVariantRow | null }) => void
}

function readPurityRank(code: string): number {
  const match = code.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:k|kt)?$/)
  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY
}

function isYellowColor(group: Pick<CatalogColorGroup, 'code' | 'label'>): boolean {
  const code = group.code.trim().toLowerCase()
  const label = group.label.trim().toLowerCase()
  return code.includes('yellow') || label.includes('yellow')
}

export function VariantSelector({ colorGroups, purities, variants, sizeOptions = [], sizeStockMap = {}, onChange }: VariantSelectorProps) {
  const activeVariants = useMemo(
    () => variants.filter((variant) => variant.is_active),
    [variants],
  )

  const sortedPurities = useMemo(
    () => [...purities].sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)),
    [purities],
  )

  const initialVariant = useMemo(() => {
    const purityById = new Map(purities.map((purity) => [purity.id, purity]))
    const activeColorIds = new Set(activeVariants.map((variant) => variant.color_id))
    const preferredYellowColorId =
      colorGroups.find((group) => activeColorIds.has(group.colorId) && isYellowColor(group))?.colorId ?? null

    return [...activeVariants].sort((a, b) => {
      if (preferredYellowColorId) {
        const aIsPreferred = a.color_id === preferredYellowColorId
        const bIsPreferred = b.color_id === preferredYellowColorId
        if (aIsPreferred !== bIsPreferred) return aIsPreferred ? -1 : 1
      }

      const purityA = purityById.get(a.purity_id)
      const purityB = purityById.get(b.purity_id)
      const rankDiff = readPurityRank(purityB?.code ?? '') - readPurityRank(purityA?.code ?? '')
      if (rankDiff !== 0) return rankDiff

      const orderDiff = (purityA?.display_order ?? Number.MAX_SAFE_INTEGER) - (purityB?.display_order ?? Number.MAX_SAFE_INTEGER)
      if (orderDiff !== 0) return orderDiff

      return a.sku.localeCompare(b.sku)
    })[0] ?? null
  }, [activeVariants, colorGroups, purities])

  const initialColorId =
    initialVariant?.color_id ??
    colorGroups[0]?.colorId ??
    ''

  const initialPurityId =
    initialVariant?.purity_id ??
    sortedPurities[0]?.id ??
    ''

  const [colorId, setColorId]   = useState(initialColorId)
  const [purityId, setPurityId] = useState(initialPurityId)
  const [sizeLabel, setSizeLabel] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    setSizeLabel(null)
  }, [sizeOptions])

  useEffect(() => {
    if (!sizeLabel) return
    if (!sizeOptions.includes(sizeLabel) || (sizeStockMap[sizeLabel] ?? 0) <= 0) {
      setSizeLabel(null)
    }
  }, [sizeLabel, sizeOptions, sizeStockMap])

  useEffect(() => {
    const availableColors = new Set(activeVariants.map((variant) => variant.color_id))
    const fallbackColor = colorGroups.find((group) => availableColors.has(group.colorId))?.colorId ?? colorGroups[0]?.colorId
    if (fallbackColor && (!colorGroups.some((group) => group.colorId === colorId) || !availableColors.has(colorId))) {
      setColorId(fallbackColor)
    }
  }, [activeVariants, colorGroups, colorId])

  useEffect(() => {
    const available = new Set(activeVariants.filter((variant) => variant.color_id === colorId).map((variant) => variant.purity_id))
    if (available.has(purityId)) return

    const fallback = sortedPurities.find((p) => available.has(p.id))
    if (fallback) setPurityId(fallback.id)
  }, [activeVariants, colorId, sortedPurities, purityId])

  const matchedVariant = useMemo(() => {
    return activeVariants.find((variant) => variant.color_id === colorId && variant.purity_id === purityId) ?? null
  }, [activeVariants, colorId, purityId])

  useEffect(() => {
    onChange({
      variantId: matchedVariant?.id ?? null,
      sizeLabel,
      quantity,
      colorId,
      variant:   matchedVariant,
    })
  }, [matchedVariant, quantity, colorId, sizeLabel, onChange])

  const purityOptionsForColor = useMemo(() => {
    const set = new Set(activeVariants.filter((variant) => variant.color_id === colorId).map((variant) => variant.purity_id))
    return sortedPurities.filter((p) => set.has(p.id))
  }, [activeVariants, colorId, sortedPurities])

  const inStock =
    !!matchedVariant && matchedVariant.is_active && matchedVariant.stock_qty > 0

  return (
    <div className="space-y-5">
      {colorGroups.length > 1 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Colour</p>
          <div className="flex flex-wrap gap-3">
            {colorGroups.map((g) => (
              <button
                key={g.colorId}
                type="button"
                title={g.label}
                onClick={() => setColorId(g.colorId)}
                className={cn(
                  'h-9 w-9 rounded-full border-2 transition-all shadow-sm ring-offset-2',
                  colorId === g.colorId ? 'ring-2 ring-teal border-deep-teal' : 'border-white/70 hover:border-teal',
                )}
                style={{ backgroundColor: g.hex ?? '#ccc' }}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Purity</p>
        <div className="flex flex-wrap gap-2">
          {purityOptionsForColor.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPurityId(p.id)}
              className={cn(
                'px-4 py-2 text-sm rounded-md border transition-all',
                purityId === p.id
                  ? 'border-teal bg-teal/10 text-teal font-medium'
                  : 'border-divider text-ink hover:border-teal',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {sizeOptions.length > 0 && (
        <div>
          <label htmlFor="ring-size" className="block text-xs uppercase tracking-widest text-ink-muted mb-2">
            Ring Size
          </label>
          <select
            id="ring-size"
            value={sizeLabel ?? ''}
            onChange={(e) => setSizeLabel(e.target.value || null)}
            className="w-40 rounded-lg border border-divider bg-bg px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-teal focus:ring-1 focus:ring-teal"
          >
            <option value="">Select size</option>
            {sizeOptions.map((size) => (
              <option key={size} value={size} disabled={(sizeStockMap[size] ?? 0) <= 0}>
                {size}{sizeStockMap[size] != null ? ` (${sizeStockMap[size]})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {matchedVariant && (
        <div className="text-sm space-y-1">
          <p>
            <span className="text-ink-muted">SKU</span>{' '}
            <span className="font-mono text-ink">{matchedVariant.sku}</span>
          </p>
          <p className={inStock ? 'text-teal font-medium' : 'text-red-600'}>
            {inStock ? `${matchedVariant.stock_qty} in stock` : 'Currently unavailable'}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Quantity</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-9 w-9 rounded-md border border-divider text-ink hover:border-teal text-lg"
          >
            −
          </button>
          <span className="w-8 text-center text-base font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(5, q + 1))}
            className="h-9 w-9 rounded-md border border-divider text-ink hover:border-teal text-lg"
          >
            +
          </button>
          {/* <span className="text-xs text-ink-faint">Max 5</span> */}
        </div>
      </div>
    </div>
  )
}
