'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  buildListingHref,
  resolveShopListingState,
} from '@/lib/shop/paths'
import { buildPriceListingHref, parsePriceListingPath } from '@/lib/shop/priceListingSlugs'

interface PaginationProps {
  total:    number
  pageSize: number
  page:     number
}

export function Pagination({ total, pageSize, page }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const priceListing = parsePriceListingPath(pathname)
  const listing = resolveShopListingState(pathname, searchParams)
  const totalPages = Math.ceil(total / pageSize)

  if (totalPages <= 1) return null

  const goTo = (p: number) => {
    const href = priceListing
      ? buildPriceListingHref(priceListing.scope, priceListing.rangeId)
      : buildListingHref({ scopeSlug: listing.scopeSlug })
    router.push(href, { scroll: true })
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  )

  return (
    <div className="flex items-center justify-center gap-1 mt-12">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-md border border-divider text-ink-muted hover:text-ink hover:border-teal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((p, i) => {
        const prev = pages[i - 1]
        const showEllipsis = prev != null && p - prev > 1
        return (
          <span key={p} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-ink-faint">…</span>}
            <button
              onClick={() => goTo(p)}
              className={`min-w-[2rem] h-8 rounded-md text-sm transition-colors ${
                p === page
                  ? 'bg-deep-teal text-cream font-medium'
                  : 'border border-divider text-ink-muted hover:border-teal hover:text-ink'
              }`}
            >
              {p}
            </button>
          </span>
        )
      })}

      <button
        onClick={() => goTo(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-md border border-divider text-ink-muted hover:text-ink hover:border-teal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
