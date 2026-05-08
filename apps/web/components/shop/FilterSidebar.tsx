'use client'

import { useRouter, usePathname } from 'next/navigation'
import { X, SlidersHorizontal } from 'lucide-react'
import { buildShopListingHref, parseShopSegments } from '@/lib/shop/paths'

const PURITIES   = ['22k', '18k', '14k', '9k', '92.5']
const CATEGORIES = ['rings', 'necklaces', 'earrings', 'bangles', 'bracelets', 'pendants', 'chains', 'sets']
const CUTS       = ['Round Brilliant', 'Princess', 'Emerald', 'Oval', 'Cushion']

interface FilterSidebarProps {
  className?: string
  onClose?:   () => void
}

export function FilterSidebar({ className = '', onClose }: FilterSidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const segments = pathname.replace(/^\/shop\/?/, '').split('/').filter(Boolean)
  const listing  = parseShopSegments(segments)
  const scopeSlug = listing?.scopeSlug ?? null
  const sort      = listing?.sort

  const navigateToScope = (nextScope: string | null) => {
    router.push(buildShopListingHref({ scopeSlug: nextScope, sort, page: 1 }), { scroll: false })
    onClose?.()
  }

  const clearAll = () => {
    router.push('/shop', { scroll: false })
    onClose?.()
  }

  const metal = scopeSlug === 'gold' || scopeSlug === 'silver' ? scopeSlug : ''
  const purity = PURITIES.filter((entry) => entry === scopeSlug)
  const diamond = scopeSlug === 'diamond'
  const cuts: string[] = []
  const catArr = CATEGORIES.filter((entry) => entry === scopeSlug)
  const hasFilters = !!scopeSlug

  return (
    <aside className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-ink">
          <SlidersHorizontal className="h-4 w-4 text-teal" />
          Filters
          {hasFilters && (
            <span className="bg-teal text-white text-xs px-2 py-0.5 rounded-full">Active</span>
          )}
        </div>
        <div className="flex gap-2">
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-teal hover:text-deep-teal transition-colors">
              Clear All
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metal Type */}
      <FilterGroup label="Metal Type">
        {[{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }].map((opt) => (
          <CheckOption
            key={opt.value}
            label={opt.label}
            checked={metal === opt.value}
            onChange={() => navigateToScope(metal === opt.value ? null : opt.value)}
          />
        ))}
      </FilterGroup>

      {/* Purity */}
      <FilterGroup label="Purity">
        {PURITIES.map((p) => (
          <CheckOption
            key={p}
            label={p === '92.5' ? '92.5 (Sterling Silver)' : p.toUpperCase()}
            checked={purity.includes(p)}
            onChange={() => navigateToScope(scopeSlug === p ? null : p)}
          />
        ))}
      </FilterGroup>

      {/* Diamond */}
      <FilterGroup label="Gemstone">
        <CheckOption
          label="With Diamond"
          checked={diamond}
          onChange={() => navigateToScope(diamond ? null : 'diamond')}
        />
        {diamond && (
          <div className="ml-4 mt-2 space-y-2">
            {CUTS.map((cut) => (
              <CheckOption
                key={cut}
                label={cut}
                checked={cuts.includes(cut)}
                onChange={() => undefined}
              />
            ))}
          </div>
        )}
      </FilterGroup>

      {/* Category */}
      <FilterGroup label="Category">
        {CATEGORIES.map((cat) => (
          <CheckOption
            key={cat}
            label={cat.charAt(0).toUpperCase() + cat.slice(1)}
            checked={catArr.includes(cat)}
            onChange={() => navigateToScope(scopeSlug === cat ? null : cat)}
          />
        ))}
      </FilterGroup>
    </aside>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-widest2 text-ink-muted mb-3">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function CheckOption({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: () => void
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-divider text-teal focus:ring-teal accent-teal"
      />
      <span className={`text-sm transition-colors ${checked ? 'text-deep-teal font-medium' : 'text-ink-muted group-hover:text-ink'}`}>
        {label}
      </span>
    </label>
  )
}
