'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Heart, Phone, MapPin, User, RefreshCw, Truck, Award, Gift } from 'lucide-react'
import { VariantSelector, type SelectedVariantState } from './VariantSelector'
import { LivePriceDisplay }  from './LivePriceDisplay'
import { ImageGallery }      from './ImageGallery'
import { ProductShare }      from './ProductShare'
import { StarRating }        from '@/components/ui/StarRating'
import { useCartStore }      from '@/stores/cartStore'
import { useProductPrice }   from '@/hooks/useProductPrice'

type Variant = Parameters<typeof VariantSelector>[0]['variants'][number]
type Image   = Parameters<typeof ImageGallery>[0]['images'][number]

interface ProductDetailClientProps {
  product: {
    id: string
    name: string
    short_description: string | null
    making_charge_pct: number
    making_charge_discount_pct: number
    gem_price_discount_pct: number
    avgRating: number
    reviewCount: number
    collectionName: string | null
    collectionSlug: string | null
    categoryName:   string | null
  }
  variants: Variant[]
  images:   Image[]
}

const SERVICE_BADGES = [
  { icon: RefreshCw, label: '100-Day Easy Returns' },
  { icon: Truck,     label: 'Free Shipping ₹5K+' },
  { icon: Award,     label: 'BIS Hallmarked' },
  { icon: Gift,      label: 'Free Gift Wrap' },
]

const TABS = ['Description', 'Material Details', 'Shipping & Returns', 'Care Guide']

export function ProductDetailClient({ product, variants, images }: ProductDetailClientProps) {
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariantState & { variant: Variant | null }>({
    variantId: variants[0]?.id ?? null,
    sizeLabel: null,
    quantity: 1,
    variant: variants[0] ?? null,
  })
  const [activeTab,   setActiveTab]   = useState(0)
  const [wishlisted,  setWishlisted]  = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  const activeVariant = selectedVariant.variant

  const priceInput = useMemo(
    () =>
      activeVariant?.weight_grams
        ? {
            weightGrams:                    activeVariant.weight_grams,
            purity:                         activeVariant.purity,
            makingChargePct:                product.making_charge_pct,
            gemPriceOverride:               activeVariant.gem_price_override,
            makingChargeDiscountPct:        product.making_charge_discount_pct,
            gemPriceDiscountPct:            product.gem_price_discount_pct,
            variantMakingChargeDiscountPct: activeVariant.making_charge_discount_pct,
            variantGemPriceDiscountPct:     activeVariant.gem_price_discount_pct,
          }
        : null,
    [activeVariant, product.making_charge_pct, product.making_charge_discount_pct, product.gem_price_discount_pct]
  )
  const { breakdown, loading: priceLoading } = useProductPrice(priceInput)
  const discountPercentOff = useMemo(() => {
    if (!breakdown) return null
    const p = breakdown.percentOffGross
    return p >= 1 ? Math.round(p) : null
  }, [breakdown])

  const handleVariantChange = useCallback(
    (state: SelectedVariantState & { variant: Variant | null }) => {
      setSelectedVariant(state)
    },
    []
  )

  const handleAddToCart = () => {
    if (!activeVariant) return
    if (priceLoading || !breakdown) {
      toast.error('Price is still loading', { description: 'Wait a moment and try again.' })
      return
    }
    if (breakdown.finalPrice <= 0) {
      toast.error('Cannot add to cart', { description: 'This variant has no calculated price (check weight & metal).' })
      return
    }
    addItem({
      productId:    product.id,
      variantId:    activeVariant.id,
      sizeLabel:    selectedVariant.sizeLabel ?? '',
      productName:  product.name,
      variantLabel: `${activeVariant.metal_variant?.variant_name ?? 'Silver'} ${activeVariant.purity}`,
      imageUrl:     images.find((i) => !i.variant_id)?.url ?? '',
      unitPrice:    breakdown.finalPrice,
      quantity:     selectedVariant.quantity,
    })
    toast.success('Added to cart! 🛍️', { description: product.name })
  }

  return (
    <div className="section-x py-10">
      <div className="grid gap-10 lg:grid-cols-2">

        {/* LEFT — Image gallery (sticky on desktop) */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ImageGallery
            images={images}
            productName={product.name}
            activeVariantId={selectedVariant.variantId}
            discountPercentOff={discountPercentOff}
          />
        </div>

        {/* RIGHT — Product info */}
        <div className="space-y-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-ink-muted">
            <Link href="/" className="hover:text-teal transition-colors">Home</Link>
            <span>/</span>
            {product.collectionSlug && (
              <>
                <Link href={`/collections/${product.collectionSlug}`} className="hover:text-teal transition-colors">
                  {product.collectionName}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-ink line-clamp-1">{product.name}</span>
          </nav>

          {/* Title */}
          <div>
            <h1 className="font-display text-display-xl text-ink leading-tight">{product.name}</h1>
            {product.short_description && (
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">{product.short_description}</p>
            )}
          </div>

          {/* Rating */}
          {product.reviewCount > 0 && (
            <StarRating
              rating={product.avgRating}
              count={product.reviewCount}
              size="md"
            />
          )}

          {/* Live price */}
          <LivePriceDisplay
            makingChargePct={product.making_charge_pct}
            breakdown={breakdown}
            loading={priceLoading}
          />

          <div className="w-full h-px bg-divider" />

          {/* Variant selector */}
          <VariantSelector variants={variants} onChange={handleVariantChange} />

          <div className="w-full h-px bg-divider" />

          {/* CTA buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!activeVariant || activeVariant.stock_status === 'out_of_stock'}
              className="w-full py-4 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {activeVariant?.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <button
              disabled={!activeVariant}
              className="w-full py-4 border border-deep-teal text-deep-teal text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-deep-teal/5 disabled:opacity-50 transition-colors"
            >
              Buy Now
            </button>
          </div>

          {/* Service badges */}
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 p-3 bg-surface rounded-lg">
                <Icon className="h-4 w-4 text-teal shrink-0" />
                <span className="text-xs text-ink-muted">{label}</span>
              </div>
            ))}
          </div>

          {/* Additional actions */}
          <div className="flex flex-wrap gap-3">
            <ProductShare productName={product.name} />
            <button
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

          {/* Description tabs */}
          <div>
            <div className="flex gap-0 border-b border-divider overflow-x-auto hide-scrollbar">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors border-b-2 -mb-px ${
                    activeTab === i
                      ? 'border-teal text-teal font-medium'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="py-4 text-sm text-ink-muted leading-relaxed">
              {activeTab === 0 && <p>Full product description will be shown here.</p>}
              {activeTab === 1 && (
                <div className="space-y-1">
                  {activeVariant && (
                    <>
                      <p>Metal: {activeVariant.metal_variant?.variant_name ?? 'Silver'}</p>
                      <p>Purity: {activeVariant.purity}</p>
                      {activeVariant.weight_grams && <p>Weight: {activeVariant.weight_grams}g</p>}
                      {activeVariant.gem_variant && <p>Diamond Cut: {activeVariant.gem_variant.cut_name}</p>}
                    </>
                  )}
                </div>
              )}
              {activeTab === 2 && <p>Free shipping on orders above ₹5,000. Easy 100-day returns.</p>}
              {activeTab === 3 && <p>Store in a dry place. Clean with a soft cloth. Avoid contact with chemicals.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
