'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildShopListingHref, parseShopSegments } from '@/lib/shop/paths'

interface PaginationProps {
  total:    number
  pageSize: number
  page:     number
}

export function Pagination({ total, pageSize, page }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const segments = pathname.replace(/^\/shop\/?/, '').split('/').filter(Boolean)
  const listing = parseShopSegments(segments)
  const totalPages  = Math.ceil(total / pageSize)

  if (totalPages <= 1) return null

  const goTo = (p: number) => {
    router.push(
      buildShopListingHref({
        scopeSlug: listing?.scopeSlug ?? null,
        sort: listing?.sort ?? 'newest',
        page: p,
      }),
      { scroll: true },
    )
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  )

  return (
    <div className="flex items-center justify-center gap-1 mt-12">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        className="p-2 text-ink-muted hover:text-deep-teal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((p, i) => {
        const prev = pages[i - 1]
        const showEllipsis = prev != null && p - prev > 1
        return (
          <span key={p} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-ink-faint text-sm">…</span>}
            <button
              onClick={() => goTo(p)}
              className={`min-w-[2rem] h-8 px-2 text-sm rounded-md transition-colors ${
                p === page
                  ? 'bg-deep-teal text-cream font-medium'
                  : 'text-ink-muted hover:bg-surface hover:text-ink'
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
        className="p-2 text-ink-muted hover:text-deep-teal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
