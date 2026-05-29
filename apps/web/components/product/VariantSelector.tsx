'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@amiora/ui'

export type CatalogColorGroup = {
  colorId: string
  code:    string
  label:   string
  hex:     string | null
  images:  string[]
}

export type CatalogPurity = {
  id:             string
  code:           string
  label:          string
  display_order:  number
}

export type CatalogVariantRow = {
  id:           string
  color_id:     string
  purity_id:    string
  sku:          string
  price:        number
  stock_qty:    number
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
  onChange:    (state: SelectedVariantState & { variant: CatalogVariantRow | null }) => void
}

export function VariantSelector({ colorGroups, purities, variants, onChange }: VariantSelectorProps) {
  const activeVariants = useMemo(
    () => variants.filter((variant) => variant.is_active),
    [variants],
  )

  const sortedPurities = useMemo(
    () => [...purities].sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)),
    [purities],
  )

  const initialColorId =
    activeVariants[0]?.color_id ??
    colorGroups[0]?.colorId ??
    ''

  const initialPurityId =
    activeVariants.find((variant) => variant.color_id === initialColorId)?.purity_id ??
    sortedPurities[0]?.id ??
    ''

  const [colorId, setColorId]   = useState(initialColorId)
  const [purityId, setPurityId] = useState(initialPurityId)
  const [quantity, setQuantity] = useState(1)

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
      sizeLabel: null,
      quantity,
      colorId,
      variant:   matchedVariant,
    })
  }, [matchedVariant, quantity, colorId, onChange])

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
          <span className="text-xs text-ink-faint">Max 5</span>
        </div>
      </div>
    </div>
  )
}
