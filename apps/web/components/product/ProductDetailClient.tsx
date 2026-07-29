'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Heart, MapPin, User, RefreshCw, Truck, Award, Gift } from 'lucide-react'
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
import { useWishlist }    from '@/hooks/useWishlist'
import {
  breakdownToDisplayRows,
  computeCatalogVariantPrice,
  formatINR,
  getRingSizeMultiplier,
  resolveLiveRate,
} from '@amiora/pricing'
import { useCatalogPrices, type CatalogPricingContext } from '@/hooks/useCatalogPrices'
import { MetalPurityTable, formatWeightGrams } from './MetalPurityTable'
import { MOBILE_NAV_HEIGHT } from '@/components/layout/MobileBottomNav'

interface ProductDetailClientProps {
  product: {
    id:                 string
    name:               string
    slug:               string
    design_number:      string | null
    short_desc:         string | null
    description:        string | null
    diamond_shape:      string | null
    diamond_count:      number | null
    total_diamond_wt:   number | null
    diamond_color:      string | null
    diamond_clarity:    string | null
    size_range:         string | null
    chain_lengths:      unknown
    variant_sizes:      unknown
    making_charge_pct:  number
    avgRating:          number
    reviewCount:        number
    collectionName:     string | null
    collectionSlug:    string | null
    categoryName:       string | null
    categorySlug:       string | null
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
  pricingContext: CatalogPricingContext
}

const SERVICE_BADGES = [
  { icon: RefreshCw, label: '15-Day Easy Returns' },
  { icon: Truck,     label: 'Free Shipping ₹5K+' },
  { icon: Award,     label: 'BIS Hallmarked' },
  { icon: Gift,      label: 'Free Gift Wrap' },
]

function readPurityRank(code: string): number {
  const match = code.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:k|kt)?$/)
  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY
}

function isYellowColor(group: Pick<CatalogColorGroup, 'code' | 'label'>): boolean {
  const code = group.code.trim().toLowerCase()
  const label = group.label.trim().toLowerCase()
  return code.includes('yellow') || label.includes('yellow')
}

function toGallery(images: string[], videos: string[], productName: string) {
  const imageItems = images.map((url, i) => ({
    id:          `cg-img-${i}`,
    url,
    media_type:  'image' as const,
    alt_text:    `${productName} — image ${i + 1}`,
    sort_order:  i,
    variant_id:  null as string | null,
  }))
  const videoItems = videos.map((url, i) => ({
    id:          `cg-vid-${i}`,
    url,
    media_type:  'video' as const,
    alt_text:    `${productName} — video ${i + 1}`,
    sort_order:  images.length + i,
    variant_id:  null as string | null,
  }))
  return [...imageItems, ...videoItems]
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

type ChainLengthRow = {
  length_inch: number
  weight_g: number
}

type VariantSizeRow = {
  variant_id: string
  size_label: string
  size_type: 'ring_us' | 'chain_inch'
  stock_qty: number
  metal_weight_g: number | null
  price_override: number | null
  is_active: boolean
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

  const result: PriceBreakupRow[] = []
  for (const row of rawRows) {
    if (!row || typeof row !== 'object') continue
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

    if (!labelRaw || amount == null) continue

    result.push({
      label: prettifyLabel(labelRaw),
      amount,
      originalAmount:
        readAmount(record.original_amount) ??
        readAmount(record.originalAmount) ??
        readAmount(record.mrp) ??
        readAmount(record.old_price) ??
        null,
    })
  }
  return result
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

function normalizeChainLengths(raw: unknown): ChainLengthRow[] {
  if (!Array.isArray(raw)) return []

  const rows: ChainLengthRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const lengthValue = Number(record.length_inch ?? record.lengthInch)
    const weightValue = Number(record.weight_g ?? record.weightG)
    if (!Number.isFinite(lengthValue) || lengthValue <= 0) continue
    if (!Number.isFinite(weightValue) || weightValue <= 0) continue
    rows.push({
      length_inch: Math.round(lengthValue * 1000) / 1000,
      weight_g: Math.round(weightValue * 1000) / 1000,
    })
  }

  return rows
}

function normalizeVariantSizes(raw: unknown): VariantSizeRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const variantId = typeof record.variant_id === 'string' ? record.variant_id : ''
      const sizeLabel = typeof record.size_label === 'string' ? record.size_label.trim() : ''
      const sizeType = record.size_type === 'chain_inch' ? 'chain_inch' : 'ring_us'
      if (!variantId || !sizeLabel) return null
      return {
        variant_id: variantId,
        size_label: sizeLabel,
        size_type: sizeType,
        stock_qty: Number(record.stock_qty ?? 0),
        metal_weight_g:
          record.metal_weight_g != null && Number.isFinite(Number(record.metal_weight_g))
            ? Number(record.metal_weight_g)
            : null,
        price_override:
          record.price_override != null && Number.isFinite(Number(record.price_override))
            ? Number(record.price_override)
            : null,
        is_active: record.is_active !== false,
      } satisfies VariantSizeRow
    })
    .filter((row): row is VariantSizeRow => row != null)
}

export function ProductDetailClient({
  product,
  catalog,
  fallbackImages,
  pricingContext,
}: ProductDetailClientProps) {
  const isRingProduct =
    product.categorySlug?.trim().toLowerCase() === 'rings' ||
    product.categoryName?.trim().toLowerCase() === 'rings'
  const ringSizeOptions = useMemo(
    () => (isRingProduct ? Array.from({ length: 23 }, (_, index) => String(index + 6)) : []),
    [isRingProduct],
  )
  const isChainProduct =
    /necklace|chain/i.test(product.categorySlug ?? '') ||
    /necklace|chain/i.test(product.categoryName ?? '')
  const chainLengthOptions = useMemo(() => normalizeChainLengths(product.chain_lengths), [product.chain_lengths])
  const variantSizeRows = useMemo(() => normalizeVariantSizes(product.variant_sizes), [product.variant_sizes])
  const purityById = new Map(catalog.purities.map((purity) => [purity.id, purity]))
  const activeColorIds = new Set(
    catalog.variants.filter((variant) => variant.is_active).map((variant) => variant.color_id),
  )
  const preferredYellowColorId =
    catalog.colorGroups.find((group) => activeColorIds.has(group.colorId) && isYellowColor(group))?.colorId ?? null
  const initialVariant =
    [...catalog.variants]
      .filter((variant) => variant.is_active)
      .sort((a, b) => {
        if (preferredYellowColorId) {
          const aIsPreferred = a.color_id === preferredYellowColorId
          const bIsPreferred = b.color_id === preferredYellowColorId
          if (aIsPreferred !== bIsPreferred) return aIsPreferred ? -1 : 1
        }

        const purityA = purityById.get(a.purity_id)
        const purityB = purityById.get(b.purity_id)
        const rankDiff = readPurityRank(purityB?.code ?? '') - readPurityRank(purityA?.code ?? '')
        if (rankDiff !== 0) return rankDiff

        const orderDiff = (purityA?.display_order ?? Number.MAX_SAFE_INTEGER) - (purityB?.display_order ?? Number.MAX_SAFE_INTEGER)
        if (orderDiff !== 0) return orderDiff

        return a.sku.localeCompare(b.sku)
      })[0] ??
    catalog.variants[0] ??
    null
  const initialColorId = initialVariant?.color_id ?? catalog.colorGroups[0]?.colorId ?? ''

  const [sel, setSel] = useState<SelectedVariantState & { variant: CatalogVariantRow | null }>(() => ({
    variantId: initialVariant?.id ?? null,
    sizeLabel: null,
    quantity:  1,
    colorId:   initialColorId,
    variant:   initialVariant,
  }))
  const [selectedChainLength, setSelectedChainLength] = useState<string>('')
  const [activeTab, setActiveTab] = useState(0)
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    if (!isChainProduct || chainLengthOptions.length === 0) return
    if (!selectedChainLength || !chainLengthOptions.some((length) => String(length.length_inch) === selectedChainLength)) {
      setSelectedChainLength(String(chainLengthOptions[0]!.length_inch))
    }
  }, [isChainProduct, chainLengthOptions, selectedChainLength])

  const activeVariantSizes = useMemo(
    () => variantSizeRows.filter((row) => row.variant_id === sel.variantId && row.is_active),
    [variantSizeRows, sel.variantId],
  )
  const ringSizeStockMap = useMemo(
    () =>
      Object.fromEntries(
        activeVariantSizes
          .filter((row) => row.size_type === 'ring_us')
          .map((row) => [row.size_label, row.stock_qty]),
      ) as Record<string, number>,
    [activeVariantSizes],
  )
  const selectedChainSizeRow = useMemo(
    () =>
      activeVariantSizes.find(
        (row) => row.size_type === 'chain_inch' && String(row.size_label) === selectedChainLength,
      ) ?? null,
    [activeVariantSizes, selectedChainLength],
  )
  const selectedRingSizeRow = useMemo(
    () =>
      activeVariantSizes.find(
        (row) => row.size_type === 'ring_us' && String(row.size_label) === String(sel.sizeLabel ?? ''),
      ) ?? null,
    [activeVariantSizes, sel.sizeLabel],
  )
  const selectedRingStockQty = sel.sizeLabel ? (ringSizeStockMap[sel.sizeLabel] ?? 0) : null
  const ringSizeMultiplier = isRingProduct ? getRingSizeMultiplier(sel.sizeLabel) : 1

  const galleryImages = useMemo(() => {
    const grp = catalog.colorGroups.find((g) => g.colorId === sel.colorId)
    const hasVariantMedia = grp && (grp.images.length > 0 || (grp.videos?.length ?? 0) > 0)
    if (hasVariantMedia && grp) {
      return toGallery(grp.images, grp.videos ?? [], product.name)
    }
    return toGallery(
      fallbackImages.map((i) => i.url),
      [],
      product.name,
    )
  }, [catalog.colorGroups, sel.colorId, fallbackImages, product.name])

  const activeVariant = sel.variant
  const { isWishlisted, toggle: toggleWishlist } = useWishlist(
    product.id,
    activeVariant?.id ?? null,
  )

  const { computedPrices, goldPerGram, silverPerGram } = useCatalogPrices(
    catalog.variants,
    catalog.purities,
    pricingContext,
  )

  const activeBreakdown = activeVariant ? computedPrices[activeVariant.id] : null
  const activePurity = activeVariant
    ? catalog.purities.find((purity) => purity.id === activeVariant.purity_id) ?? null
    : null
  const ringBreakdown = useMemo(() => {
    if (!isRingProduct || !activeVariant || !activePurity) return null
    const ringWeight = selectedRingSizeRow?.metal_weight_g ?? activeVariant.metal_weight_g
    if (ringWeight == null || !Number.isFinite(ringWeight) || ringWeight <= 0) return null
    return computeCatalogVariantPrice({
      metalWeightG: ringWeight,
      purityCode: activePurity.code,
      metalType: activePurity.metal,
      makingChargePct: pricingContext.makingChargePct,
      stoneLines: pricingContext.stoneLines,
      goldPerGram,
      goldPurityRates: pricingContext.goldPurityRates,
      silverPerGram,
      diamondPricePerCarat: pricingContext.initialDiamondPerCarat,
      makingChargeDiscountPct: pricingContext.makingChargeDiscountPct,
      gemPriceDiscountPct: pricingContext.gemPriceDiscountPct,
    })
  }, [
    isRingProduct,
    activeVariant,
    activePurity,
    selectedRingSizeRow?.metal_weight_g,
    pricingContext.makingChargePct,
    pricingContext.stoneLines,
    pricingContext.goldPurityRates,
    pricingContext.makingChargeDiscountPct,
    pricingContext.gemPriceDiscountPct,
    pricingContext.initialDiamondPerCarat,
    goldPerGram,
    silverPerGram,
  ])
  const selectedChainOption = useMemo(
    () => chainLengthOptions.find((length) => String(length.length_inch) === selectedChainLength) ?? null,
    [chainLengthOptions, selectedChainLength],
  )
  const chainBreakdown = useMemo(() => {
    if (!isChainProduct || !selectedChainOption || !activePurity) return null
    return computeCatalogVariantPrice({
      metalWeightG: selectedChainOption.weight_g,
      purityCode: activePurity.code,
      metalType: activePurity.metal,
      makingChargePct: pricingContext.makingChargePct,
      stoneLines: pricingContext.stoneLines,
      addonPriceOverride: selectedChainSizeRow?.price_override ?? 0,
      goldPerGram,
      goldPurityRates: pricingContext.goldPurityRates,
      silverPerGram,
      diamondPricePerCarat: pricingContext.initialDiamondPerCarat,
      makingChargeDiscountPct: pricingContext.makingChargeDiscountPct,
      gemPriceDiscountPct: pricingContext.gemPriceDiscountPct,
    })
  }, [
    isChainProduct,
    selectedChainOption,
    activePurity,
    selectedChainSizeRow?.price_override,
    pricingContext.makingChargePct,
    pricingContext.stoneLines,
    pricingContext.goldPurityRates,
    pricingContext.makingChargeDiscountPct,
    pricingContext.gemPriceDiscountPct,
    pricingContext.initialDiamondPerCarat,
    goldPerGram,
    silverPerGram,
  ])
  const displayBreakdown =
    isChainProduct && chainBreakdown ? chainBreakdown
    : isRingProduct && ringBreakdown ? ringBreakdown
    : activeBreakdown
  const displayPrice =
    displayBreakdown != null
      ? Math.round(displayBreakdown.finalPrice * (isRingProduct ? ringSizeMultiplier : 1) * 100) / 100
      : 0
  const displayVariant =
    isChainProduct && activeVariant
      ? {
          ...activeVariant,
          metal_weight_g: selectedChainOption?.weight_g ?? activeVariant.metal_weight_g,
        }
      : activeVariant

  const handleVariantChange = useCallback(
    (state: SelectedVariantState & { variant: CatalogVariantRow | null }) => {
      setSel(state)
    },
    [],
  )

  const inStock =
    !!activeVariant &&
    activeVariant.is_active &&
    activeVariant.stock_qty > 0 &&
    (!isRingProduct || selectedRingStockQty == null || selectedRingStockQty > 0) &&
    (!isChainProduct || (selectedChainSizeRow?.stock_qty ?? 0) > 0)

  const handleAddToCart = () => {
    if (!activeVariant || !inStock) {
      toast.error('Unavailable', { description: 'Pick an in-stock option.' })
      return
    }
    if (isRingProduct && !sel.sizeLabel) {
      toast.error('Select ring size', { description: 'Choose a size from 6 to 28 before adding this ring.' })
      return
    }
    if (isRingProduct && sel.sizeLabel && (ringSizeStockMap[sel.sizeLabel] ?? 0) <= 0) {
      toast.error('Ring size unavailable', { description: 'Pick a size that is in stock.' })
      return
    }
    if (isChainProduct && (!selectedChainOption || (selectedChainSizeRow?.stock_qty ?? 0) <= 0)) {
      toast.error('Select chain length', { description: 'Choose a chain length before adding this piece.' })
      return
    }
    const thumb =
      galleryImages.find((item) => item.media_type !== 'video')?.url ??
      galleryImages[0]?.url ??
      ''
    addItem({
      productId:    product.id,
      variantId:    activeVariant.id,
      variantSku:   activeVariant.sku,
      sizeLabel:    isChainProduct ? String(selectedChainOption?.length_inch ?? '') : sel.sizeLabel ?? '',
      productName:  product.name,
      variantLabel: activeVariant.sku,
      imageUrl:     thumb,
      unitPrice:    displayPrice,
      quantity:     sel.quantity,
      productSlug:  product.slug,
      collectionSlug: product.collectionSlug ?? null,
      categorySlug:   product.categorySlug ?? null,
      metalWeightG: activeVariant.metal_weight_g ?? undefined,
      metalRatePerGram: resolveLiveRate(
        catalog.purities.find((p) => p.id === activeVariant.purity_id)?.metal,
        goldPerGram,
        silverPerGram,
        catalog.purities.find((p) => p.id === activeVariant.purity_id)?.code ?? '',
        pricingContext.goldPurityRates,
      ),
    })
    toast.success('Added to cart!', { description: product.name })
  }

  const TABS = ['Metal & Purity', 'Price Breakup', 'Care Guide']
  const liveBreakupRows = useMemo(() => {
    if (!displayBreakdown) return null
    const sizePremiumPct = isRingProduct ? (ringSizeMultiplier - 1) * 100 : 0
    return breakdownToDisplayRows(displayBreakdown, pricingContext.makingChargePct, sizePremiumPct)
  }, [displayBreakdown, pricingContext.makingChargePct, isRingProduct, ringSizeMultiplier])

  const canAddToCart =
    !!activeVariant &&
    inStock &&
    (!isRingProduct || !!sel.sizeLabel) &&
    (!isChainProduct || !!selectedChainOption)
  const addToCartLabel = !activeVariant ? 'Select options' : !canAddToCart ? 'Choose size' : 'Add to Cart'

  return (
    <>
    <div className="section-x py-6 md:py-10 pb-28 md:pb-10 overflow-x-hidden">
      <div className="grid gap-6 lg:gap-10 lg:grid-cols-2">
        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <ImageGallery
            key={sel.colorId}
            images={galleryImages}
            productName={product.name}
          />
        </div>

        <div className="min-w-0 space-y-5 md:space-y-6">
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
            <h1 className="font-display text-display-lg md:text-display-xl text-ink leading-tight">{product.name}</h1>
            {/* {product.design_number && (
              <p className="mt-2 text-xs text-ink-muted font-mono tracking-wide">
                Design No. {product.design_number}
              </p>
            )} */}
            {product.short_desc && (
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">{product.short_desc}</p>
            )}
          </div>

          {product.reviewCount > 0 && (
            <StarRating rating={product.avgRating} count={product.reviewCount} size="md" />
          )}

          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="shrink-0 whitespace-nowrap font-display text-2xl sm:text-3xl text-ink tabular-nums">
                {displayPrice > 0 ? formatINR(displayPrice) : '—'}
              </p>
              {activeVariant && (
                <span className="min-w-0 break-all text-xs text-ink-muted font-mono">{activeVariant.sku}</span>
              )}
            </div>
            {activeVariant?.metal_weight_g != null && (
              <p className="text-sm text-ink-muted">
                Net metal weight: <span className="text-ink tabular-nums">{formatWeightGrams(activeVariant.metal_weight_g)}</span>
              </p>
            )}
          </div>

          <div className="w-full h-px bg-divider" />

          <VariantSelector
            colorGroups={catalog.colorGroups}
            purities={catalog.purities}
            variants={catalog.variants}
            sizeOptions={ringSizeOptions}
            sizeStockMap={ringSizeStockMap}
            onChange={handleVariantChange}
          />

          {isChainProduct && chainLengthOptions.length > 0 && (
            <div className="rounded-2xl border border-divider bg-surface/40 p-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Chain Length</p>
                <select
                  value={selectedChainLength}
                  onChange={(e) => setSelectedChainLength(e.target.value)}
                  className="w-full rounded-lg border border-divider bg-white px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-teal focus:ring-1 focus:ring-teal"
                >
                  {chainLengthOptions.map((length) => (
                    <option
                      key={length.length_inch}
                      value={String(length.length_inch)}
                      disabled={(activeVariantSizes.find((row) => row.size_type === 'chain_inch' && String(row.size_label) === String(length.length_inch))?.stock_qty ?? 0) <= 0}
                    >
                      {length.length_inch}" · {length.weight_g.toFixed(3)} g
                      {activeVariantSizes.find((row) => row.size_type === 'chain_inch' && String(row.size_label) === String(length.length_inch))?.stock_qty != null
                        ? ` · Stock ${(activeVariantSizes.find((row) => row.size_type === 'chain_inch' && String(row.size_label) === String(length.length_inch))?.stock_qty ?? 0)}`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-muted">
                <div className="rounded-lg bg-white px-3 py-2">
                  Chain stock: <span className="text-ink">{selectedChainSizeRow?.stock_qty ?? 0}</span>
                </div>
                <div className="rounded-lg bg-white px-3 py-2">
                  Chain cost: <span className="text-ink">{selectedChainSizeRow?.price_override != null ? formatINR(selectedChainSizeRow.price_override) : '—'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                <span className="text-ink-muted">Selected length price</span>
                <span className="font-display text-lg text-ink tabular-nums">
                  {displayBreakdown ? formatINR(displayBreakdown.finalPrice) : '—'}
                </span>
              </div>
            </div>
          )}

          <div className="w-full h-px bg-divider" />

          <div className="hidden md:flex flex-col gap-3">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className="w-full py-4 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addToCartLabel}
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

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <ProductShare productName={product.name} />
            <button
              type="button"
              onClick={() => toggleWishlist()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              <Heart className={`h-4 w-4 shrink-0 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              {isWishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>
            <Link
              href="/stores"
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              <MapPin className="h-4 w-4 shrink-0" /> Visit Store
            </Link>
            <Link
              href="/customization"
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              <User className="h-4 w-4 shrink-0" /> Request Demo
            </Link>
          </div>

          <div className="min-w-0 overflow-x-hidden">
            <div className="flex gap-0 border-b border-divider overflow-x-auto hide-scrollbar">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap shrink-0 transition-colors border-b-2 -mb-px font-semibold ${
                    activeTab === i ? 'border-teal text-teal' : 'border-transparent text-ink hover:text-deep-teal'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="py-4 text-sm text-ink-muted leading-relaxed space-y-3">
              {activeTab === 0 && (
                <MetalPurityTable
                  selectedVariant={displayVariant}
                  selectedPurity={activePurity}
                  breakdown={displayBreakdown}
                  stoneLines={pricingContext.stoneLines}
                />
              )}
              {activeTab === 1 && (
                liveBreakupRows ? (
                  <div className="space-y-3">
                    <h4 className="font-display text-lg text-ink">Price Breakup</h4>
                    <div className="md:hidden space-y-2">
                      {liveBreakupRows.map((row) => (
                        <div
                          key={`${row.label}-${row.amount}-mobile`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-divider bg-surface px-3 py-2.5"
                        >
                          <span className="text-sm text-ink font-medium">{row.label}</span>
                          <span className="text-sm text-ink tabular-nums shrink-0">{formatINR(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm border-collapse min-w-[22rem]">
                        <thead>
                          <tr className="bg-surface">
                            <th className="text-left px-3 py-2 border border-divider text-ink">Particulars</th>
                            <th className="text-left px-3 py-2 border border-divider text-ink">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liveBreakupRows.map((row) => (
                            <tr key={`${row.label}-${row.amount}`} className="bg-white">
                              <td className="px-3 py-2 border border-divider/80 text-ink font-medium">{row.label}</td>
                              <td className="px-3 py-2 border border-divider/80 text-ink tabular-nums">
                                {formatINR(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* <p className="text-xs text-ink-faint">
                      Based on today&apos;s gold/silver rate. Diamond/stone price stays fixed.
                    </p> */}
                  </div>
                ) : (
                  <p>Set metal weight per purity in admin to see price breakup.</p>
                )
              )}
              {activeTab === 2 && (
                <p>Store in a dry place. Clean with a soft cloth. Avoid contact with chemicals.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Sticky mobile buy bar — sits above bottom nav */}
    <div
      className="md:hidden fixed left-0 right-0 z-40 border-t border-divider bg-white shadow-[0_-4px_16px_rgba(26,20,16,0.08)] px-4 py-3"
      style={{ bottom: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 min-w-0">
          <p className="font-display text-xl text-ink tabular-nums leading-none">
            {displayPrice > 0 ? formatINR(displayPrice) : '—'}
          </p>
          {activeVariant?.metal_weight_g != null && (
            <p className="text-2xs text-ink-muted mt-0.5 tabular-nums">
              {formatWeightGrams(activeVariant.metal_weight_g)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          className="flex-1 py-3.5 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {addToCartLabel}
        </button>
      </div>
    </div>
    </>
  )
}
