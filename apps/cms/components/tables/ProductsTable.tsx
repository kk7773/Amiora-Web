'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, Filter, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'
import { getStorefrontUrl } from '@/lib/storefrontUrl'

interface Product {
  id: string
  name: string
  slug: string
  design_number?: string | null
  product_code?: string | null
  is_featured: boolean
  status: 'draft' | 'active' | 'archived'
  created_at: string
  collection?: { name: string } | null
  collection_links?: { collections: { name: string } | null }[] | null
  category?:   { name: string } | null
  images?:  { url: string; is_primary: boolean }[]
  color_groups?: { color_id: string; color_label: string; images: string[]; display_order: number; is_active: boolean }[]
  variants?: {
    id: string
    color_id: string | null
    color_label: string
    purity_id: string | null
    purity_label: string
    stock_qty: number
    is_active: boolean
  }[]
}

type ProductVariant = NonNullable<Product['variants']>[number]

type StockTone = 'default' | 'warning' | 'error'

function getVariantStockTone(stockQty: number): StockTone {
  if (stockQty <= 0) return 'error'
  if (stockQty <= 3) return 'warning'
  return 'default'
}

function getVariantStockLabel(stockQty: number) {
  if (stockQty <= 0) return 'Out of stock'
  if (stockQty <= 3) return `Low stock (${stockQty})`
  return `In stock (${stockQty})`
}

function getProductStockSummary(product: Product) {
  const activeVariants = (product.variants ?? []).filter((variant) => variant.is_active)
  const outCount = activeVariants.filter((variant) => variant.stock_qty <= 0).length
  const lowCount = activeVariants.filter((variant) => variant.stock_qty > 0 && variant.stock_qty <= 3).length

  if (outCount > 0) {
    return {
      tone: 'error' as const,
      label: `${outCount} variant${outCount > 1 ? 's' : ''} out of stock`,
    }
  }
  if (lowCount > 0) {
    return {
      tone: 'warning' as const,
      label: `${lowCount} variant${lowCount > 1 ? 's' : ''} low stock`,
    }
  }
  return {
    tone: 'default' as const,
    label: activeVariants.length > 0 ? 'Stock healthy' : 'No active variants',
  }
}

function getRowToneClass(product: Product) {
  const summary = getProductStockSummary(product)
  if (summary.tone === 'error') return 'bg-red-50/70 hover:bg-red-50'
  if (summary.tone === 'warning') return 'bg-amber-50/70 hover:bg-amber-50'
  return 'hover:bg-surface/50'
}

function buildColorHierarchy(product: Product) {
  const groups = new Map<string, { colorLabel: string; variants: ProductVariant[] }>()
  for (const variant of product.variants ?? []) {
    const colorKey = variant.color_id ?? variant.color_label
    const current = groups.get(colorKey) ?? { colorLabel: variant.color_label, variants: [] }
    current.variants.push(variant)
    groups.set(colorKey, current)
  }
  return Array.from(groups.values()).sort((a, b) => a.colorLabel.localeCompare(b.colorLabel))
}

function resolveCollectionNames(product: Product): string {
  const fromLinks = (product.collection_links ?? [])
    .map((link) => link.collections?.name)
    .filter((n): n is string => !!n)
  if (fromLinks.length > 0) return fromLinks.join(', ')
  return product.collection?.name ?? '—'
}

function productInCollection(product: Product, collectionName: string): boolean {
  const names = (product.collection_links ?? [])
    .map((link) => link.collections?.name)
    .filter((n): n is string => !!n)
  if (names.length > 0) return names.includes(collectionName)
  return product.collection?.name === collectionName
}

function resolveThumbnail(product: Product): string | null {
  const legacy =
    product.images?.find((img) => img.is_primary)?.url ??
    product.images?.[0]?.url
  if (legacy?.trim()) return legacy.trim()

  const groups = [...(product.color_groups ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  )
  for (const group of groups) {
    if (!group.is_active) continue
    const url = group.images?.find((u) => typeof u === 'string' && u.trim())
    if (url) return url.trim()
  }
  for (const group of groups) {
    const url = group.images?.find((u) => typeof u === 'string' && u.trim())
    if (url) return url.trim()
  }
  return null
}

interface Props {
  products:    Product[]
  collections: { id: string; name: string }[]
  categories:  { id: string; name: string }[]
}

export function ProductsTable({ products, collections, categories }: Props) {
  const [search, setSearch] = useState('')
  const [filterCollection, setFilterCollection] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [failedThumbnails, setFailedThumbnails] = useState<string[]>([])

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.slug.includes(q) &&
      !(p.design_number ?? '').toLowerCase().includes(q) &&
      !(p.product_code ?? '').toLowerCase().includes(q)
    ) {
      return false
    }
    if (filterCollection && !productInCollection(p, filterCollection)) return false
    if (filterStatus === 'active' && p.status !== 'active') return false
    if (filterStatus === 'inactive' && p.status === 'active') return false
    return true
  })

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(`${name} deleted`)
      window.location.reload()
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-divider overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-divider flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 flex-1">
          <Search className="w-3.5 h-3.5 text-ink-faint" />
          <input
            placeholder="Search by name, slug, design #, or product ID…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-ink-faint"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-ink-faint" />
          <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} className="bg-surface border border-divider rounded-lg px-3 py-2 text-sm outline-none text-ink-muted">
            <option value="">All Collections</option>
            {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-surface border border-divider rounded-lg px-3 py-2 text-sm outline-none text-ink-muted">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Draft / archived</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider bg-surface">
              <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium w-12"></th>
              <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Name</th>
              <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Collection</th>
              <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Variants</th>
              <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Status</th>
              <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Created</th>
              <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {filtered.map(p => {
              const thumbnailUrl = resolveThumbnail(p)
              const stockSummary = getProductStockSummary(p)
              return (
                <tr key={p.id} className={`${getRowToneClass(p)} transition-colors`}>
                  <td className="px-5 py-3">
                    {thumbnailUrl ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface-2">
                        {!failedThumbnails.includes(p.id) ? (
                          <Image
                            src={thumbnailUrl}
                            alt={p.name}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="40px"
                            onError={() => setFailedThumbnails((prev) => [...prev, p.id])}
                          />
                        ) : (
                          <img src={thumbnailUrl} alt={p.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface-2" />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-ink-faint">{p.slug}</p>
                    {p.product_code && <p className="text-xs text-ink-muted font-mono mt-0.5">ID {p.product_code}</p>}
                    {!p.product_code && p.design_number && (
                      <p className="text-xs text-ink-muted font-mono mt-0.5">Design {p.design_number}</p>
                    )}
                    {p.is_featured && <Badge variant="info" className="mt-1">Featured</Badge>}
                    <div className="mt-3 space-y-2 max-w-[34rem]">
                      {buildColorHierarchy(p).map((group) => {
                        const groupHasOut = group.variants.some((variant) => variant.is_active && variant.stock_qty <= 0)
                        const groupHasLow = group.variants.some((variant) => variant.is_active && variant.stock_qty > 0 && variant.stock_qty <= 3)
                        const groupVariant = groupHasOut ? 'error' : groupHasLow ? 'warning' : 'default'

                        return (
                          <div key={group.colorLabel} className="rounded-lg border border-divider bg-white/70 px-2.5 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={groupVariant}>{group.colorLabel}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {group.variants
                                .slice()
                                .sort((a, b) => a.purity_label.localeCompare(b.purity_label))
                                .map((variant) => (
                                  <Badge
                                    key={variant.id}
                                    variant={
                                      !variant.is_active
                                        ? 'default'
                                        : getVariantStockTone(variant.stock_qty) === 'error'
                                          ? 'error'
                                          : getVariantStockTone(variant.stock_qty) === 'warning'
                                            ? 'warning'
                                            : 'success'
                                    }
                                    className="gap-1"
                                  >
                                    {variant.purity_label}
                                    {' · '}
                                    {variant.is_active ? getVariantStockLabel(variant.stock_qty) : 'Inactive'}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{resolveCollectionNames(p)}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-surface rounded-full text-xs font-medium text-ink-muted">
                      {p.variants?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={p.status === 'active' ? 'success' : 'default'}>
                      {p.status === 'active' ? 'Active' : p.status === 'draft' ? 'Draft' : 'Archived'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-muted text-xs">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/products/${p.id}`} className="p-1.5 rounded-lg hover:bg-surface text-ink-muted hover:text-teal transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Link>
                      <a href={`${getStorefrontUrl()}/products/${p.slug}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-surface text-ink-muted hover:text-teal transition-colors" title="View on storefront">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={deleting === p.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-faint">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-divider text-xs text-ink-faint">
        Showing {filtered.length} of {products.length} products
      </div>
    </div>
  )
}
