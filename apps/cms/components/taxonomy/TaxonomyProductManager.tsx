'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Search, Loader2, Package, GripVertical, Trash2, Plus, ChevronUp, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'

export type TaxonomyType = 'collection' | 'category' | 'tag'

const PAGE_SIZE = 25

type ProductRow = {
  id: string
  name: string
  slug: string
  design_number: string | null
  product_number: number
  status: string
  image_url: string | null
  display_order?: number
}

type SearchHit = {
  id: string
  name: string
  design_number: string | null
  product_number: number
  status: string
  image_url: string | null
}

type ListResponse = {
  products: ProductRow[]
  productCount: number
  page: number
  limit: number
  hasMore: boolean
}

type Props = {
  type: TaxonomyType
  id: string
  name: string
  open: boolean
  onClose: () => void
  onCountChange?: (count: number) => void
  categories?: { id: string; name: string }[]
}

function apiBase(type: TaxonomyType, id: string) {
  if (type === 'collection') return `/api/taxonomy/collections/${id}/products`
  if (type === 'category') return `/api/taxonomy/categories/${id}/products`
  return `/api/taxonomy/tags/${id}/products`
}

function listUrl(base: string, page: number) {
  return `${base}?page=${page}&limit=${PAGE_SIZE}`
}

const TYPE_LABEL: Record<TaxonomyType, string> = {
  collection: 'Collection',
  category: 'Category',
  tag: 'Tag',
}

export function TaxonomyProductManager({
  type,
  id,
  name,
  open,
  onClose,
  onCountChange,
  categories = [],
}: Props) {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const loadingMoreRef = useRef(false)
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ProductRow | null>(null)
  const [newCategoryId, setNewCategoryId] = useState('')
  const [thumbCache, setThumbCache] = useState<Record<string, string | null>>({})

  const base = apiBase(type, id)
  const canReorder = type === 'collection'
  const onCountChangeRef = useRef(onCountChange)
  onCountChangeRef.current = onCountChange

  const sentinelRef = useRef<HTMLDivElement>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const thumbPendingRef = useRef<Set<string>>(new Set())
  const thumbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbCacheRef = useRef(thumbCache)
  thumbCacheRef.current = thumbCache
  const rowObserverRef = useRef<IntersectionObserver | null>(null)

  const assignedIds = useMemo(() => new Set(products.map((p) => p.id)), [products])
  const loadedIds = useMemo(() => products.map((p) => p.id), [products])

  const fetchThumbnails = useCallback(async (ids: string[]) => {
    const need = ids.filter(
      (pid) => !(pid in thumbCacheRef.current) && !thumbPendingRef.current.has(pid),
    )
    if (need.length === 0) return

    need.forEach((pid) => thumbPendingRef.current.add(pid))
    try {
      const res = await fetch(`/api/products/thumbnails?ids=${encodeURIComponent(need.join(','))}`)
      if (!res.ok) return
      const j = (await res.json()) as { thumbnails: Record<string, string | null> }
      setThumbCache((prev) => ({ ...prev, ...j.thumbnails }))
    } finally {
      need.forEach((pid) => thumbPendingRef.current.delete(pid))
    }
  }, [])

  const scheduleThumbFetch = useCallback((ids: string[]) => {
    if (thumbDebounceRef.current) clearTimeout(thumbDebounceRef.current)
    thumbDebounceRef.current = setTimeout(() => {
      void fetchThumbnails(ids)
    }, 100)
  }, [fetchThumbnails])

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      if (loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch(listUrl(base, pageNum))
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? 'Failed to load products')
      }
      const j = (await res.json()) as ListResponse

      setTotalCount(j.productCount)
      onCountChangeRef.current?.(j.productCount)
      setHasMore(j.hasMore)
      setPage(j.page)

      setProducts((prev) => (append ? [...prev, ...j.products] : j.products))

      const newIds = j.products.map((p) => p.id)
      if (newIds.length > 0) scheduleThumbFetch(newIds)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load products')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [base, scheduleThumbFetch])

  useEffect(() => {
    if (!open) return

    setSearchQ('')
    setSearchHits([])
    setSelected(new Set())
    setRemoveTarget(null)
    setProducts([])
    setThumbCache({})
    setTotalCount(null)
    setHasMore(false)
    setPage(1)

    void loadPage(1, false)
  }, [open, base, loadPage])

  useEffect(() => {
    if (!open || !hasMore || loading || loadingMore) return

    const root = listScrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(page + 1, true)
        }
      },
      { root, rootMargin: '120px', threshold: 0 },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [open, hasMore, loading, loadingMore, page, loadPage])

  useEffect(() => {
    if (!open) return

    rowObserverRef.current?.disconnect()
    const root = listScrollRef.current
    if (!root) return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible: string[] = []
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pid = entry.target.getAttribute('data-product-id')
            if (pid) visible.push(pid)
          }
        }
        if (visible.length > 0) scheduleThumbFetch(visible)
      },
      { root, rootMargin: '40px', threshold: 0.1 },
    )
    rowObserverRef.current = obs

    const rows = root.querySelectorAll('[data-product-id]')
    rows.forEach((el) => obs.observe(el))

    return () => obs.disconnect()
  }, [open, products, scheduleThumbFetch])

  useEffect(() => {
    if (!open || searchQ.trim().length < 2) {
      setSearchHits([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const exclude = loadedIds.join(',')
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(searchQ.trim())}&excludeIds=${encodeURIComponent(exclude)}&limit=15`,
        )
        if (!res.ok) throw new Error()
        const j = (await res.json()) as { products: SearchHit[] }
        setSearchHits(j.products ?? [])
        const hitIds = (j.products ?? []).map((p) => p.id)
        if (hitIds.length > 0) scheduleThumbFetch(hitIds)
      } catch {
        setSearchHits([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ, open, loadedIds, scheduleThumbFetch])

  function toggleSelect(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  async function addSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    setBusy(true)
    try {
      const res = await fetch(listUrl(base, 1), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids }),
      })
      if (!res.ok) {
        const j = (await res.json()) as { error?: string }
        throw new Error(j.error ?? 'Add failed')
      }
      const j = (await res.json()) as ListResponse & { added?: number }
      setProducts(j.products ?? [])
      setTotalCount(j.productCount)
      setHasMore(j.hasMore)
      setPage(1)
      onCountChangeRef.current?.(j.productCount)
      setSelected(new Set())
      setSearchQ('')
      setSearchHits([])
      toast.success(`Added ${j.added ?? ids.length} product${ids.length !== 1 ? 's' : ''}`)
      scheduleThumbFetch((j.products ?? []).map((p) => p.id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add failed'
      if (msg.includes('collection_products')) {
        toast.error('Run migration 020 in Supabase first (collection_products table)')
      } else {
        toast.error(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(productId: string, reassignCategoryId?: string) {
    setBusy(true)
    try {
      let res: Response
      if (type === 'category') {
        if (!reassignCategoryId) {
          toast.error('Select a category to move this product to')
          setBusy(false)
          return
        }
        res = await fetch(`${base}?productId=${encodeURIComponent(productId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newCategoryId: reassignCategoryId }),
        })
      } else {
        res = await fetch(`${base}?productId=${encodeURIComponent(productId)}`, {
          method: 'DELETE',
        })
      }
      if (!res.ok) {
        const j = (await res.json()) as { error?: string }
        throw new Error(j.error ?? 'Remove failed')
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId))
      setTotalCount((c) => {
        const next = c != null ? Math.max(0, c - 1) : c
        if (next != null) onCountChangeRef.current?.(next)
        return next
      })
      setRemoveTarget(null)
      setNewCategoryId('')
      toast.success('Product removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  async function moveProduct(index: number, dir: -1 | 1) {
    if (!canReorder) return
    const product = products[index]
    if (!product) return

    const next = [...products]
    const target = index + dir
    if (target < 0 || target >= next.length) return

    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setProducts(next)
    setBusy(true)

    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, direction: dir === -1 ? 'up' : 'down' }),
      })
      if (!res.ok) {
        const j = (await res.json()) as { error?: string }
        throw new Error(j.error ?? 'Reorder failed')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reorder failed')
      void loadPage(1, false)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const otherCategories = categories.filter((c) => c.id !== id)
  const displayCount = totalCount ?? products.length

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white border-l border-divider shadow-2xl flex flex-col"
        role="dialog"
        aria-label={`Manage products — ${name}`}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-divider bg-surface/50 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              {TYPE_LABEL[type]} products
            </p>
            <h2 className="font-display text-xl text-deep-teal mt-0.5">{name}</h2>
            <p className="text-sm text-ink-muted mt-1">
              {loading && totalCount === null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              ) : (
                <>
                  {displayCount} product{displayCount !== 1 ? 's' : ''} assigned
                  {canReorder && displayCount > 1 ? ' · use arrows to reorder' : ''}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface text-ink-muted"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div ref={listScrollRef} className="flex-1 overflow-y-auto">
          <div className="p-5 border-b border-divider space-y-3">
            <p className="text-sm font-medium text-ink">Add products</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search name, design number, product #…"
                className="w-full pl-9 pr-3 py-2.5 border border-divider rounded-lg text-sm"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-ink-faint" />
              )}
            </div>

            {searchHits.length > 0 && (
              <div className="border border-divider rounded-lg divide-y divide-divider max-h-48 overflow-y-auto">
                {searchHits.map((hit) => (
                  <label
                    key={hit.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(hit.id)}
                      onChange={() => toggleSelect(hit.id)}
                      className="rounded accent-deep-teal"
                    />
                    <LazyThumb productId={hit.id} name={hit.name} cache={thumbCache} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{hit.name}</p>
                      <p className="text-xs text-ink-faint font-mono">
                        {hit.design_number ?? `#${hit.product_number}`}
                      </p>
                    </div>
                    <StatusBadge status={hit.status} />
                  </label>
                ))}
              </div>
            )}

            {searchQ.trim().length >= 2 && !searching && searchHits.length === 0 && (
              <p className="text-xs text-ink-faint">No matching products</p>
            )}

            {selected.size > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void addSelected()}
                className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white text-sm font-medium rounded-lg hover:bg-teal disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add {selected.size} selected
              </button>
            )}
          </div>

          <div className="p-5 space-y-2">
            <p className="text-sm font-medium text-ink">Assigned products</p>
            {loading && products.length === 0 ? (
              <ProductListSkeleton />
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-ink-faint">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No products yet — search above to add</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {products.map((product, index) => (
                  <li
                    key={product.id}
                    data-product-id={product.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-divider bg-white hover:border-teal/30 transition-colors"
                  >
                    {canReorder && (
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          disabled={index === 0 || busy}
                          onClick={() => void moveProduct(index, -1)}
                          className="p-0.5 text-ink-faint hover:text-teal disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <GripVertical className="w-3.5 h-3.5 text-ink-faint mx-auto" />
                        <button
                          type="button"
                          disabled={index === products.length - 1 || busy}
                          onClick={() => void moveProduct(index, 1)}
                          className="p-0.5 text-ink-faint hover:text-teal disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <LazyThumb productId={product.id} name={product.name} cache={thumbCache} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{product.name}</p>
                      <p className="text-xs text-ink-faint font-mono">
                        {product.design_number ?? `#${product.product_number}`}
                      </p>
                    </div>
                    <StatusBadge status={product.status} />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (type === 'category') setRemoveTarget(product)
                        else void removeProduct(product.id)
                      }}
                      className="p-1.5 rounded hover:bg-red-50 text-ink-faint hover:text-red-600 shrink-0"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {hasMore && <div ref={sentinelRef} className="h-8" />}

            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-ink-faint" />
              </div>
            )}
          </div>
        </div>
      </aside>

      {removeTarget && type === 'category' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRemoveTarget(null)} />
          <div className="relative bg-white rounded-xl border border-divider shadow-xl p-5 max-w-sm w-full space-y-4">
            <h3 className="font-display text-lg text-deep-teal">Move product</h3>
            <p className="text-sm text-ink-muted">
              <strong>{removeTarget.name}</strong> needs a category. Choose where to move it:
            </p>
            <select
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select category…</option>
              {otherCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="px-4 py-2 text-sm text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newCategoryId || busy}
                onClick={() => void removeProduct(removeTarget.id, newCategoryId)}
                className="px-4 py-2 bg-deep-teal text-white text-sm rounded-lg disabled:opacity-50"
              >
                Move & remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function LazyThumb({
  productId,
  name,
  cache,
}: {
  productId: string
  name: string
  cache: Record<string, string | null>
}) {
  const url = cache[productId]
  if (url) {
    return (
      <div className="w-10 h-10 rounded-md overflow-hidden bg-surface shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
    )
  }
  return (
    <div className="w-10 h-10 rounded-md bg-surface flex items-center justify-center shrink-0 animate-pulse">
      <Package className="w-4 h-4 text-ink-faint opacity-50" />
    </div>
  )
}

function ProductListSkeleton() {
  return (
    <ul className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-divider bg-surface/40 animate-pulse"
        >
          <div className="w-10 h-10 rounded-md bg-surface-2 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-surface-2 rounded w-3/4" />
            <div className="h-2.5 bg-surface-2 rounded w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active'
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-ink-faint'
      }`}
    >
      {status}
    </span>
  )
}
