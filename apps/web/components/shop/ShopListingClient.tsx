'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard, type ProductCardProps } from '@/components/product/ProductCard'
import { SHOP_PAGE_SIZE } from '@/lib/shop/fetchShopListing'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rated', label: 'Best Rated' },
] as const

export type ShopListingFilters = {
  metal?: string
  purity?: string[]
  diamond?: boolean
  category?: string[]
  collection?: string
  price?: string
}

type ShopListingClientProps = {
  initialProducts: ProductCardProps['product'][]
  total: number
  pageSize?: number
  initialPage?: number
  initialSort?: string
  filters?: ShopListingFilters
}

function buildListingQuery(
  page: number,
  sort: string,
  filters: ShopListingFilters,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('sort', sort)
  if (filters.metal) params.set('metal', filters.metal)
  if (filters.diamond) params.set('diamond', 'true')
  if (filters.purity?.length) params.set('purity', filters.purity.join(','))
  if (filters.category?.length) params.set('category', filters.category.join(','))
  if (filters.collection) params.set('collection', filters.collection)
  if (filters.price) params.set('price', filters.price)
  return params.toString()
}

export function ShopListingClient({
  initialProducts,
  total: initialTotal,
  pageSize = SHOP_PAGE_SIZE,
  initialPage = 1,
  initialSort = 'newest',
  filters = {},
}: ShopListingClientProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [page, setPage] = useState(initialPage)
  const [sort, setSort] = useState(initialSort)
  const [products, setProducts] = useState(initialProducts)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.has('page') || searchParams.has('sort')) {
      window.history.replaceState(null, '', pathname)
    }
  }, [pathname, searchParams])

  const fetchPage = useCallback(
    async (nextPage: number, nextSort: string) => {
      setLoading(true)
      try {
        const qs = buildListingQuery(nextPage, nextSort, filters)
        const res = await fetch(`/api/shop/listing?${qs}`)
        const data = (await res.json()) as {
          products: ProductCardProps['product'][]
          total: number
        }
        setProducts(data.products ?? [])
        setTotal(data.total ?? 0)
        setPage(nextPage)
        setSort(nextSort)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } finally {
        setLoading(false)
      }
    },
    [filters],
  )

  const totalPages = Math.ceil(total / pageSize)
  const rangeStart = total ? Math.min((page - 1) * pageSize + 1, total) : 0
  const rangeEnd = total ? Math.min(page * pageSize, total) : 0

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
  )

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4">
        <p className="text-sm text-ink-muted hidden sm:block">
          {loading
            ? 'Loading…'
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </p>
        <div className="relative inline-flex items-center ml-auto">
          <select
            value={sort}
            disabled={loading}
            onChange={(e) => fetchPage(1, e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-bg border border-divider rounded-md text-ink cursor-pointer hover:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition-colors disabled:opacity-50"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-ink-muted pointer-events-none" />
        </div>
      </div>

      {products.length === 0 && !loading ? (
        <div className="py-24 text-center">
          <p className="font-display text-xl text-ink-muted mb-4">No products match your filters</p>
          <p className="text-sm text-ink-faint mb-6">Try adjusting or clearing your filters</p>
          <a href="/shop" className="text-sm text-teal underline underline-offset-4">
            Clear all filters
          </a>
        </div>
      ) : (
        <div
          className={`grid gap-5 grid-cols-2 lg:grid-cols-3 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-12">
          <button
            type="button"
            onClick={() => fetchPage(page - 1, sort)}
            disabled={page <= 1 || loading}
            className="p-2 rounded-md border border-divider text-ink-muted hover:text-ink hover:border-teal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageNumbers.map((p, i) => {
            const prev = pageNumbers[i - 1]
            const showEllipsis = prev != null && p - prev > 1
            return (
              <span key={p} className="flex items-center gap-1">
                {showEllipsis && <span className="px-1 text-ink-faint">…</span>}
                <button
                  type="button"
                  onClick={() => fetchPage(p, sort)}
                  disabled={loading}
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
            type="button"
            onClick={() => fetchPage(page + 1, sort)}
            disabled={page >= totalPages || loading}
            className="p-2 rounded-md border border-divider text-ink-muted hover:text-ink hover:border-teal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )
}
