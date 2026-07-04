'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { buildPriceListingHref, parsePriceListingPath, JEWELLERY_SCOPE } from '@/lib/shop/priceListingSlugs'
import { PRICE_RANGE_BUCKETS, type PriceRangeId } from '@/lib/shop/priceRanges'

const METALS = ['gold'] as const
const PURITIES = ['22k', '18k', '14k', '9k'] as const
const CATEGORIES = ['rings', 'necklaces', 'earrings', 'bangles', 'pendants', 'chains', 'sets'] as const
const DIAMOND_SHAPES = [
  { value: 'round', label: 'Round' },
  { value: 'oval', label: 'Oval' },
  { value: 'princess', label: 'Princess' },
  { value: 'tear', label: 'Tear' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'pear', label: 'Pear' },
  { value: 'heart', label: 'Heart' },
  { value: 'marquis', label: 'Marquis' },
] as const

interface FilterSidebarProps {
  className?: string
  onClose?: () => void
}

export function FilterSidebar({ className = '', onClose }: FilterSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const priceListing = parsePriceListingPath(pathname)
  const priceScope = priceListing?.scope ?? JEWELLERY_SCOPE
  const activeRangeId = priceListing?.rangeId ?? null
  const selectedMetals = readListParam(searchParams, 'metal')
  const selectedPurities = readListParam(searchParams, 'purity')
  const selectedCategories = readListParam(searchParams, 'category')
  const selectedDiamondShapes = readListParam(searchParams, 'diamond_shape')

  const navigateToPrice = (rangeId: PriceRangeId) => {
    router.push(buildPriceListingHref(priceScope, rangeId), { scroll: false })
    onClose?.()
  }

  const clearAll = () => {
    router.push('/shop', { scroll: false })
    onClose?.()
  }

  const updateQueryList = (key: 'metal' | 'purity' | 'category' | 'diamond_shape', value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    const normalizedValue = value.trim().toLowerCase()
    const currentValues = readListParam(searchParams, key)
    const nextValues = currentValues.includes(normalizedValue)
      ? currentValues.filter((entry) => entry !== normalizedValue)
      : [...currentValues, normalizedValue]

    if (nextValues.length > 0) {
      next.set(key, nextValues.join(','))
    } else {
      next.delete(key)
    }

    next.delete('page')
    router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false })
    onClose?.()
  }

  const hasFilters =
    selectedMetals.length > 0 ||
    selectedPurities.length > 0 ||
    selectedCategories.length > 0 ||
    selectedDiamondShapes.length > 0 ||
    !!priceListing

  return (
    <aside className={`space-y-6 ${className}`}>
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

      <FilterGroup label="Price Range">
        {PRICE_RANGE_BUCKETS.map((bucket) => (
          <CheckOption
            key={bucket.id}
            label={bucket.label}
            checked={activeRangeId === bucket.id}
            onChange={() => navigateToPrice(bucket.id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Metal Type">
        {METALS.map((metal) => (
          <CheckOption
            key={metal}
            label={metal.charAt(0).toUpperCase() + metal.slice(1)}
            checked={selectedMetals.includes(metal)}
            onChange={() => updateQueryList('metal', metal)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Purity">
        {PURITIES.map((purity) => (
          <CheckOption
            key={purity}
            label={purity.toUpperCase()}
            checked={selectedPurities.includes(purity)}
            onChange={() => updateQueryList('purity', purity)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Gemstone">
        {DIAMOND_SHAPES.map((shape) => (
          <CheckOption
            key={shape.value}
            label={shape.label}
            checked={selectedDiamondShapes.includes(shape.value)}
            onChange={() => updateQueryList('diamond_shape', shape.value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Category">
        {CATEGORIES.map((category) => (
          <CheckOption
            key={category}
            label={category.charAt(0).toUpperCase() + category.slice(1)}
            checked={selectedCategories.includes(category)}
            onChange={() => updateQueryList('category', category)}
          />
        ))}
      </FilterGroup>
    </aside>
  )
}

function readListParam(searchParams: ReturnType<typeof useSearchParams>, key: 'metal' | 'purity' | 'category' | 'diamond_shape'): string[] {
  const raw = searchParams.get(key)
  if (!raw) return []
  return [...new Set(raw.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean))]
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
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
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
