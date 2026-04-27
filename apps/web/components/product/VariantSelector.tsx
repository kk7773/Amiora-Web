'use client'

import { useState, useCallback } from 'react'
import { cn } from '@amiora/ui'

interface Variant {
  id:                 string
  purity:             string
  metal_variant_id:   string | null
  gem_variant_id:     string | null
  weight_grams:       number | null
  gem_price_override: number | null
  gem_weight_ct:      number | null
  stock_status:       string
  /** null = use product default */
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?:     number | null
  metal_variant?: { variant_name: string } | null
  gem_variant?:   { cut_name: string }     | null
  sizes?: { size_label: string; in_stock: boolean }[]
}

export interface SelectedVariantState {
  variantId:   string | null
  sizeLabel:   string | null
  quantity:    number
}

interface VariantSelectorProps {
  variants:  Variant[]
  onChange:  (state: SelectedVariantState & { variant: Variant | null }) => void
}

export function VariantSelector({ variants, onChange }: VariantSelectorProps) {
  // Group variants
  const metalTypes  = Array.from(new Set(variants.map((v) => v.metal_variant?.variant_name ?? 'Silver')))
  const purities    = Array.from(new Set(variants.map((v) => v.purity)))
  const hasDiamond  = variants.some((v) => v.gem_variant_id)

  const [metalType,  setMetalType]  = useState<string>(metalTypes[0]  ?? '')
  const [purity,     setPurity]     = useState<string>(purities[0]    ?? '')
  const [withDiamond,setWithDiamond]= useState(hasDiamond && variants[0]?.gem_variant_id != null)
  const [diamondCut, setDiamondCut] = useState<string | null>(null)
  const [sizeLabel,  setSizeLabel]  = useState<string | null>(null)
  const [quantity,   setQuantity]   = useState(1)

  const matchedVariant = variants.find((v) => {
    const nameMatch = (v.metal_variant?.variant_name ?? 'Silver') === metalType
    const purMatch  = v.purity === purity
    const gemMatch  = withDiamond
      ? v.gem_variant_id != null && (!diamondCut || v.gem_variant?.cut_name === diamondCut)
      : v.gem_variant_id == null
    return nameMatch && purMatch && gemMatch
  }) ?? variants[0] ?? null

  const gemCuts = Array.from(new Set(
    variants
      .filter((v) => v.gem_variant_id && v.metal_variant?.variant_name === metalType && v.purity === purity)
      .map((v) => v.gem_variant?.cut_name)
      .filter(Boolean) as string[]
  ))

  const notify = useCallback(
    (state: SelectedVariantState) => {
      onChange({ ...state, variant: matchedVariant })
    },
    [matchedVariant, onChange]
  )

  return (
    <div className="space-y-5">
      {/* Metal Type */}
      {metalTypes.length > 1 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Metal</p>
          <div className="flex flex-wrap gap-2">
            {metalTypes.map((mt) => (
              <ToggleBtn
                key={mt}
                active={metalType === mt}
                onClick={() => { setMetalType(mt); notify({ variantId: matchedVariant?.id ?? null, sizeLabel, quantity }) }}
              >
                {mt}
              </ToggleBtn>
            ))}
          </div>
        </div>
      )}

      {/* Purity */}
      <div>
        <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Purity</p>
        <div className="flex flex-wrap gap-2">
          {purities.map((p) => (
            <ToggleBtn
              key={p}
              active={purity === p}
              onClick={() => { setPurity(p); notify({ variantId: matchedVariant?.id ?? null, sizeLabel, quantity }) }}
            >
              {p === '92.5' ? '92.5 Sterling' : p.toUpperCase()}
            </ToggleBtn>
          ))}
        </div>
      </div>

      {/* Diamond toggle */}
      {hasDiamond && (
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Diamond</p>
          <div className="flex gap-2">
            {[true, false].map((val) => (
              <ToggleBtn
                key={String(val)}
                active={withDiamond === val}
                onClick={() => { setWithDiamond(val); setDiamondCut(null); notify({ variantId: matchedVariant?.id ?? null, sizeLabel, quantity }) }}
              >
                {val ? 'With Diamond' : 'Without Diamond'}
              </ToggleBtn>
            ))}
          </div>
        </div>
      )}

      {/* Diamond cut */}
      {withDiamond && gemCuts.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Diamond Cut</p>
          <div className="flex flex-wrap gap-2">
            {gemCuts.map((cut) => (
              <ToggleBtn
                key={cut}
                active={diamondCut === cut}
                onClick={() => { setDiamondCut(cut); notify({ variantId: matchedVariant?.id ?? null, sizeLabel, quantity }) }}
              >
                {cut}
              </ToggleBtn>
            ))}
          </div>
        </div>
      )}

      {/* Sizes */}
      {matchedVariant?.sizes && matchedVariant.sizes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-widest text-ink-muted">Size</p>
            <button className="text-xs text-teal underline underline-offset-2">Size Guide</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {matchedVariant.sizes.map((s) => (
              <button
                key={s.size_label}
                disabled={!s.in_stock}
                onClick={() => { setSizeLabel(s.size_label); notify({ variantId: matchedVariant.id, sizeLabel: s.size_label, quantity }) }}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md border transition-colors',
                  sizeLabel === s.size_label
                    ? 'border-teal bg-teal/10 text-teal font-medium'
                    : s.in_stock
                    ? 'border-divider text-ink hover:border-teal hover:text-teal'
                    : 'border-divider text-ink-faint line-through cursor-not-allowed'
                )}
              >
                {s.size_label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div>
        <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Quantity</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { const q = Math.max(1, quantity - 1); setQuantity(q); notify({ variantId: matchedVariant?.id ?? null, sizeLabel, quantity: q }) }}
            className="h-9 w-9 rounded-md border border-divider text-ink hover:border-teal hover:text-teal transition-colors text-lg"
          >
            −
          </button>
          <span className="w-8 text-center text-base font-medium">{quantity}</span>
          <button
            onClick={() => { const q = Math.min(5, quantity + 1); setQuantity(q); notify({ variantId: matchedVariant?.id ?? null, sizeLabel, quantity: q }) }}
            className="h-9 w-9 rounded-md border border-divider text-ink hover:border-teal hover:text-teal transition-colors text-lg"
          >
            +
          </button>
          <span className="text-xs text-ink-faint">Max 5</span>
        </div>
      </div>
    </div>
  )
}

function ToggleBtn({
  active, onClick, children, disabled,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 text-sm rounded-md border transition-all duration-200',
        active
          ? 'border-teal bg-teal text-white font-medium shadow-teal'
          : 'border-divider text-ink hover:border-teal hover:text-teal',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}
