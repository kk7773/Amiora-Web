'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  buildListingHref,
  pathnameToListingSegments,
  parseShopSegments,
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
  const segments = pathnameToListingSegments(pathname)
  const listing = parseShopSegments(segments)
  const isCollectionsPath = pathname.startsWith('/collections/')
  const current = priceListing
    ? priceListing.sort
    : isCollectionsPath
      ? (searchParams.get('sort') ?? 'newest')
      : (listing?.sort ?? 'newest')

  const handleChange = (value: string) => {
    let href: string
    if (priceListing) {
      href = buildPriceListingHref(priceListing.scope, priceListing.rangeId, {
        sort: value,
        page: 1,
      })
    } else if (isCollectionsPath && listing?.scopeSlug) {
      href = buildListingHref(
        { scopeSlug: listing.scopeSlug, sort: value, page: 1 },
        {},
        '/collections',
      )
    } else {
      href = buildListingHref(
        { scopeSlug: listing?.scopeSlug ?? null, sort: value, page: 1 },
        {},
      )
    }
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
