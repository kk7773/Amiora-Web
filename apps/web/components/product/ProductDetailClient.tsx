'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Heart, Phone, MapPin, User, RefreshCw, Truck, Award, Gift } from 'lucide-react'
import {
  VariantSelector,
  type CatalogColorGroup,
  type CatalogPurity,
  type CatalogVariantRow,
  type SelectedVariantState,
} from './VariantSelector'
import { ImageGallery } from './ImageGallery'
import { ProductShare }   from './ProductShare'
import { StarRating }     from '@/components/ui/StarRating'
import { useCartStore }   from '@/stores/cartStore'
import { formatINR }    from '@/lib/pricing/calculator'

interface ProductDetailClientProps {
  product: {
    id:                 string
    name:               string
    short_desc:         string | null
    description:        string | null
    diamond_shape:      string | null
    diamond_count:      number | null
    total_diamond_wt:   number | null
    diamond_color:      string | null
    diamond_clarity:    string | null
    size_range:         string | null
    making_charge_pct:  number
    avgRating:          number
    reviewCount:        number
    collectionName:     string | null
    collectionSlug:    string | null
    categoryName:       string | null
  }
  catalog: {
    colorGroups: CatalogColorGroup[]
    purities:    CatalogPurity[]
    variants:    CatalogVariantRow[]
  }
  fallbackImages: {
    id:          string
    url:         string
    alt_text:    string | null
    sort_order: number
  }[]
}

const SERVICE_BADGES = [
  { icon: RefreshCw, label: '100-Day Easy Returns' },
  { icon: Truck,     label: 'Free Shipping ₹5K+' },
  { icon: Award,     label: 'BIS Hallmarked' },
  { icon: Gift,      label: 'Free Gift Wrap' },
]

function toGallery(images: string[], productName: string) {
  return images.map((url, i) => ({
    id:          `cg-${i}`,
    url,
    alt_text:    `${productName} — image ${i + 1}`,
    sort_order:  i,
    variant_id:  null as string | null,
  }))
}

type PriceBreakupRow = {
  label: string
  amount: number | string
  originalAmount?: number | string | null
}

type PriceBreakupPayload = {
  rows: PriceBreakupRow[]
  note: string | null
}

function prettifyLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function readAmount(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  return null
}

function parseBreakupRows(rawRows: unknown): PriceBreakupRow[] {
  if (!Array.isArray(rawRows)) return []

  return rawRows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const record = row as Record<string, unknown>

      const labelRaw =
        (typeof record.label === 'string' && record.label) ||
        (typeof record.particular === 'string' && record.particular) ||
        (typeof record.particulars === 'string' && record.particulars) ||
        (typeof record.name === 'string' && record.name) ||
        (typeof record.title === 'string' && record.title) ||
        null

      const amount =
        readAmount(record.amount) ??
        readAmount(record.price) ??
        readAmount(record.value) ??
        readAmount(record.net) ??
        readAmount(record.total)

      if (!labelRaw || amount == null) return null

      return {
        label: prettifyLabel(labelRaw),
        amount,
        originalAmount:
          readAmount(record.original_amount) ??
          readAmount(record.originalAmount) ??
          readAmount(record.mrp) ??
          readAmount(record.old_price) ??
          null,
      } satisfies PriceBreakupRow
    })
    .filter((row): row is PriceBreakupRow => row != null)
}

function normalizePriceBreakup(raw: unknown): PriceBreakupPayload | null {
  if (!raw) return null

  if (Array.isArray(raw)) {
    const rows = parseBreakupRows(raw)
    return rows.length ? { rows, note: null } : null
  }

  if (typeof raw !== 'object') return null

  const record = raw as Record<string, unknown>
  const nestedRows = parseBreakupRows(record.rows ?? record.items ?? record.lines)
  const note =
    (typeof record.note === 'string' && record.note.trim()) ||
    (typeof record.footer_note === 'string' && record.footer_note.trim()) ||
    (typeof record.disclaimer === 'string' && record.disclaimer.trim()) ||
    null

  if (nestedRows.length > 0) return { rows: nestedRows, note }

  const scalarRows = Object.entries(record)
    .map(([key, value]) => {
      const amount = readAmount(value)
      if (amount == null) return null
      return { label: prettifyLabel(key), amount } satisfies PriceBreakupRow
    })
    .filter((row): row is PriceBreakupRow => row != null)

  return scalarRows.length ? { rows: scalarRows, note } : null
}

function displayMoney(value: number | string): string {
  if (typeof value === 'number') return formatINR(value)
  const maybeNumber = Number(value.replace(/[^\d.-]/g, ''))
  if (Number.isFinite(maybeNumber) && value.trim().match(/^[\d\s,.-]+$/)) {
    return formatINR(maybeNumber)
  }
  return value
}

export function ProductDetailClient({ product, catalog, fallbackImages }: ProductDetailClientProps) {
  const initialVariant = catalog.variants.find((variant) => variant.is_active) ?? catalog.variants[0] ?? null
  const initialColorId = initialVariant?.color_id ?? catalog.colorGroups[0]?.colorId ?? ''

  const [sel, setSel] = useState<SelectedVariantState & { variant: CatalogVariantRow | null }>(() => ({
    variantId: initialVariant?.id ?? null,
    sizeLabel: null,
    quantity:  1,
    colorId:   initialColorId,
    variant:   initialVariant,
  }))
  const [activeTab,  setActiveTab]  = useState(0)
  const [wishlisted, setWishlisted] = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  const galleryImages = useMemo(() => {
    const grp = catalog.colorGroups.find((g) => g.colorId === sel.colorId)
    const urls =
      grp && grp.images.length > 0
        ? grp.images
        : fallbackImages.map((i) => i.url)
    return toGallery(urls, product.name)
  }, [catalog.colorGroups, sel.colorId, fallbackImages, product.name])

  const activeVariant = sel.variant

  const displayPrice =
    activeVariant && activeVariant.is_active ? Number(activeVariant.price) : 0

  const handleVariantChange = useCallback(
    (state: SelectedVariantState & { variant: CatalogVariantRow | null }) => {
      setSel(state)
    },
    [],
  )

  const inStock =
    !!activeVariant && activeVariant.is_active && activeVariant.stock_qty > 0

  const handleAddToCart = () => {
    if (!activeVariant || !inStock) {
      toast.error('Unavailable', { description: 'Pick an in-stock option.' })
      return
    }
    const thumb = galleryImages[0]?.url ?? ''
    addItem({
      productId:    product.id,
      variantId:    activeVariant.id,
      sizeLabel:    '',
      productName:  product.name,
      variantLabel: activeVariant.sku,
      imageUrl:     thumb,
      unitPrice:    displayPrice,
      quantity:     sel.quantity,
    })
    toast.success('Added to cart!', { description: product.name })
  }

  const TABS = ['Description', 'Diamond details', 'Price Breakup', 'Shipping & Returns', 'Care Guide']
  const priceBreakup = useMemo(
    () => normalizePriceBreakup(activeVariant?.price_breakup ?? null),
    [activeVariant?.price_breakup],
  )

  return (
    <div className="section-x py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ImageGallery images={galleryImages} productName={product.name} />
        </div>

        <div className="space-y-6">
          <nav className="flex items-center gap-1 text-xs text-ink-muted">
            <Link href="/" className="hover:text-teal transition-colors">Home</Link>
            <span>/</span>
            {product.collectionSlug && (
              <>
                <Link href={`/shop/${product.collectionSlug}`} className="hover:text-teal transition-colors">
                  {product.collectionName}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-ink line-clamp-1">{product.name}</span>
          </nav>

          <div>
            <h1 className="font-display text-display-xl text-ink leading-tight">{product.name}</h1>
            {product.short_desc && (
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">{product.short_desc}</p>
            )}
          </div>

          {product.reviewCount > 0 && (
            <StarRating rating={product.avgRating} count={product.reviewCount} size="md" />
          )}

          <div className="flex flex-wrap items-baseline gap-3">
            <p className="font-display text-3xl text-ink tabular-nums">
              {displayPrice > 0 ? formatINR(displayPrice) : '—'}
            </p>
            {activeVariant && (
              <span className="text-xs text-ink-muted font-mono">{activeVariant.sku}</span>
            )}
          </div>

          <div className="w-full h-px bg-divider" />

          <VariantSelector
            colorGroups={catalog.colorGroups}
            purities={catalog.purities}
            variants={catalog.variants}
            onChange={handleVariantChange}
          />

          <div className="w-full h-px bg-divider" />

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inStock}
              className="w-full py-4 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {!activeVariant ? 'Select options' : inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>

          <div className="rounded-lg border border-divider px-4 py-3 text-sm text-ink-muted">
            Delivery & pincode checker — coming soon for your area.
          </div>

          <div className="grid grid-cols-2 gap-3">
            {SERVICE_BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 p-3 bg-surface rounded-lg">
                <Icon className="h-4 w-4 text-teal shrink-0" />
                <span className="text-xs text-ink-muted">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <ProductShare productName={product.name} />
            <button
              type="button"
              onClick={() => setWishlisted((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              <Heart className={`h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              {wishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>
            <Link
              href="/stores"
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              <MapPin className="h-4 w-4" /> Visit Store
            </Link>
            <Link
              href="/customization"
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              <User className="h-4 w-4" /> Request Demo
            </Link>
            <a
              href="tel:+919876543210"
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              <Phone className="h-4 w-4" /> Callback
            </a>
          </div>

          <div>
            <div className="flex gap-0 border-b border-divider overflow-x-auto hide-scrollbar">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors border-b-2 -mb-px ${
                    activeTab === i ? 'border-teal text-teal font-medium' : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="py-4 text-sm text-ink-muted leading-relaxed space-y-3">
              {activeTab === 0 && (
                <p>{product.description ?? product.short_desc ?? 'Details will appear here.'}</p>
              )}
              {activeTab === 1 && (
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {[
                      ['Shape', product.diamond_shape],
                      ['Stone count', product.diamond_count != null ? String(product.diamond_count) : null],
                      ['Total weight (ct)', product.total_diamond_wt != null ? String(product.total_diamond_wt) : null],
                      ['Diamond colour', product.diamond_color],
                      ['Clarity', product.diamond_clarity],
                      ['Size / length', product.size_range],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <tr key={String(k)} className="border-b border-divider/60">
                          <td className="py-2 pr-4 text-ink-faint">{k}</td>
                          <td className="py-2 text-ink">{v}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {activeTab === 2 && (
                priceBreakup ? (
                  <div className="space-y-3">
                    <h4 className="font-display text-lg text-ink">Price Breakup</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse min-w-[22rem]">
                        <thead>
                          <tr className="bg-surface">
                            <th className="text-left px-3 py-2 border border-divider text-ink">Particulars</th>
                            <th className="text-left px-3 py-2 border border-divider text-ink">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceBreakup.rows.map((row) => (
                            <tr key={`${row.label}-${String(row.amount)}`} className="bg-white">
                              <td className="px-3 py-2 border border-divider/80 text-ink">{row.label}</td>
                              <td className="px-3 py-2 border border-divider/80 text-ink">
                                <span className="inline-flex items-center gap-2">
                                  {row.originalAmount != null && (
                                    <span className="text-ink-faint line-through">{displayMoney(row.originalAmount)}</span>
                                  )}
                                  <span>{displayMoney(row.amount)}</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-ink-faint">
                      {priceBreakup.note ?? 'Final price calculated at checkout based on actual weight.'}
                    </p>
                  </div>
                ) : (
                  <p>Price breakup will be available soon.</p>
                )
              )}
              {activeTab === 3 && <p>Free shipping on orders above ₹5,000. Easy 100-day returns.</p>}
              {activeTab === 4 && (
                <p>Store in a dry place. Clean with a soft cloth. Avoid contact with chemicals.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
