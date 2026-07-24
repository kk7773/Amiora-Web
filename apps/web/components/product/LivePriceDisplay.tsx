'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { formatINR, type PriceBreakdown } from '@/lib/pricing/calculator'

interface LivePriceDisplayProps {
  makingChargePct:   number
  /** From `useProductPrice` (single source of truth on PDP) */
  breakdown:         PriceBreakdown | null
  loading:           boolean
}

export function LivePriceDisplay({
  makingChargePct,
  breakdown,
  loading,
}: LivePriceDisplayProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  if (!breakdown && !loading) {
    return <p className="text-sm text-ink-muted">Price on request</p>
  }

  return (
    <div className="space-y-2">
      {/* Main price */}
      <div className="flex items-center gap-2">
        {loading || !breakdown ? (
          <div className="skeleton h-8 w-36 rounded" />
        ) : (
          <p className="text-3xl font-semibold text-deep-teal tabular-nums">
            {formatINR(breakdown.finalPrice)}
          </p>
        )}
        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="p-1 text-ink-faint hover:text-teal transition-colors"
          aria-label="Price breakdown"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      {/* Breakdown tooltip */}
      {showBreakdown && breakdown && (
        <div className="bg-surface border border-divider rounded-xl p-4 text-sm space-y-2 w-full max-w-xs">
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-3">Price Breakdown</p>
          <Row label="Base Metal Price" value={breakdown.baseMetalPrice} />
          <Row label={`Making Charges`
            } value={breakdown.makingCharge} />
          {breakdown.gemPrice > 0 && (
            <Row label="Diamond / Gemstone" value={breakdown.gemPrice} />
          )}
          <Row label="GST (3%)" value={breakdown.gstAmount} />
          <div className="border-t border-divider pt-2 mt-2">
            <Row label="Total" value={breakdown.finalPrice} bold />
          </div>
          <p className="text-2xs text-ink-faint mt-2">
            Purity: {(breakdown.purityMultiplier * 100).toFixed(1)}% fine metal ·
            Inclusive of 3% GST · Live price
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatINR(value)}</span>
    </div>
  )
}
