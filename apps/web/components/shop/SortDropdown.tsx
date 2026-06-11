'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  buildListingHref,
  resolveShopListingState,
} from '@/lib/shop/paths'
import { buildPriceListingHref, parsePriceListingPath } from '@/lib/shop/priceListingSlugs'

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc',label: 'Price: High to Low' },
  { value: 'popular',   label: 'Most Popular' },
  { value: 'rated',     label: 'Best Rated' },
]

export function SortDropdown() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const priceListing = parsePriceListingPath(pathname)
  const listing = resolveShopListingState(pathname, searchParams)
  const current = priceListing ? priceListing.sort : listing.sort

  const handleChange = (value: string) => {
    const href = priceListing
      ? buildPriceListingHref(priceListing.scope, priceListing.rangeId)
      : buildListingHref({ scopeSlug: listing.scopeSlug })
    router.push(href, { scroll: false })
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm bg-bg border border-divider rounded-md text-ink cursor-pointer hover:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-colors"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-ink-muted pointer-events-none" />
    </div>
  )
}
