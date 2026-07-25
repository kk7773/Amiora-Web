'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@amiora/ui'
import { StarRating } from '@/components/ui/StarRating'
import { useCartStore } from '@/stores/cartStore'
import { useWishlist } from '@/hooks/useWishlist'
import { formatINR } from '@/lib/pricing/calculator'
import { getProductHref } from '@/lib/shop/paths'

interface ProductCardImage {
  url: string | null
  alt_text: string | null
  is_primary: boolean
  is_hover: boolean
}

interface ProductCardVariant {
  id: string
  sku: string
  price: number
  stock_qty: number
  is_active?: boolean
}

export interface ProductCardProps {
  product: {
    id: string
    name: string
    slug: string
    making_charge_pct: number
    making_charge_discount_pct?: number | null
    gem_price_discount_pct?: number | null
    product_images?: ProductCardImage[] | null
    product_variants?: ProductCardVariant[] | null
    /** computed live price — pass from server or pricing hook */
    basePrice?: number
    /** Effective % off vs undiscounted total; from `attachCardPrice` */
    discountPercentOff?: number | null
    avgRating?: number
    reviewCount?: number
    collectionName?: string | null
    collectionSlug?: string | null
    categoryName?: string | null
    categorySlug?: string | null
  }
  badgeLabel?: string
  className?: string
}

const HOVER_IMAGE_DELAY_MS = 1000

export function ProductCard({ product, badgeLabel, className }: ProductCardProps) {
  const [hovered, setHovered] = useState(false)
  const [showHoverImage, setShowHoverImage] = useState(false)
  const hoverImageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const addItem  = useCartStore((s) => s.addItem)
  const router   = useRouter()

  const images = Array.isArray(product.product_images) ? product.product_images : []
  const validImages = images.filter((img) => typeof img?.url === 'string' && img.url.trim() !== '')
  const primaryImage = validImages.find((i) => i.is_primary && i.url) ?? validImages[0] ?? null
  const hoverImage =
    validImages.find((i) => i.is_hover && i.url && i.url !== primaryImage?.url) ??
    validImages.find((i) => i.url && i.url !== primaryImage?.url) ??
    null

  const hasAlternateImage = Boolean(hoverImage?.url && hoverImage.url !== primaryImage?.url)
  const hasImage = Boolean(primaryImage?.url)

  const handleCardMouseEnter = () => {
    setHovered(true)
    if (!hasAlternateImage) return
    if (hoverImageTimerRef.current) clearTimeout(hoverImageTimerRef.current)
    hoverImageTimerRef.current = setTimeout(() => {
      setShowHoverImage(true)
      hoverImageTimerRef.current = null
    }, HOVER_IMAGE_DELAY_MS)
  }

  const handleCardMouseLeave = () => {
    setHovered(false)
    setShowHoverImage(false)
    if (hoverImageTimerRef.current) {
      clearTimeout(hoverImageTimerRef.current)
      hoverImageTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (hoverImageTimerRef.current) clearTimeout(hoverImageTimerRef.current)
    }
  }, [])

  const variants = Array.isArray(product.product_variants) ? product.product_variants : []
  const firstVariant = variants.find((v) => (v.stock_qty ?? 0) > 0 && (v.is_active ?? true)) ?? variants[0] ?? null
  const { isWishlisted, toggle: toggleWishlist } = useWishlist(product.id, firstVariant?.id ?? null)
  const displayPrice = product.basePrice ?? 0
  const inStock = firstVariant ? (firstVariant.stock_qty ?? 0) > 0 : false
  const productHref = product.slug ? getProductHref(product as { slug: string; collectionSlug?: string | null; categorySlug?: string | null }) : '/shop'
  const isRingProduct =
    product.categorySlug?.trim().toLowerCase() === 'rings' ||
    product.categoryName?.trim().toLowerCase() === 'rings'

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isRingProduct) {
      router.push(productHref)
      toast.info('Select ring size on product page')
      return
    }
    if (!firstVariant) return
    addItem({
      productId:    product.id,
      variantId:    firstVariant.id,
      variantSku:   firstVariant.sku,
      sizeLabel:    '',
      productName:  product.name,
      variantLabel: firstVariant.sku,
      imageUrl:     primaryImage?.url ?? '',
      unitPrice:    displayPrice,
      quantity:     1,
      productSlug:  product.slug,
      collectionSlug: product.collectionSlug ?? null,
      categorySlug:   product.categorySlug ?? null,
    })
    toast.success('Added to cart', { description: product.name })
  }

  const handleWishlist = (e: React.MouseEvent) => {
    toggleWishlist(e)
  }

  return (
    <Link
      href={productHref}
      className={cn('group block', className)}
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
    >
      {/* Image container */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface">
        {hasImage ? (
          !imageFailed ? (
            <>
              <Image
                src={primaryImage!.url!}
                alt={primaryImage?.alt_text ?? product.name}
                fill
                className={cn(
                  'object-cover transition-all duration-500 group-hover:scale-105',
                  showHoverImage && hasAlternateImage ? 'opacity-0' : 'opacity-100',
                )}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                onError={() => setImageFailed(true)}
              />
              {showHoverImage && hasAlternateImage && (
                <Image
                  src={hoverImage!.url!}
                  alt={hoverImage?.alt_text ?? `${product.name} — alternate view`}
                  fill
                  className="object-cover transition-all duration-500 group-hover:scale-105 opacity-100"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              )}
            </>
          ) : (
            <img
              src={(showHoverImage && hasAlternateImage ? hoverImage : primaryImage)!.url!}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-light-teal/20 to-cream" />
        )}

        {/* Overlay badges */}
        <div className="absolute inset-0 pointer-events-none">
          {!inStock && (
            <div className="absolute inset-0 bg-ink/30 flex items-center justify-center">
              <span className="text-xs uppercase tracking-widest text-white font-medium">
                Made to Order
              </span>
            </div>
          )}
        </div>

        {/* Top-right: discount % + tag + heart */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          {product.discountPercentOff != null && product.discountPercentOff >= 1 && (
            <span className="bg-deep-teal text-cream text-2xs sm:text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums shadow-sm">
              {product.discountPercentOff}% off
            </span>
          )}
          {badgeLabel && (
            <span className="bg-deep-teal text-cream text-2xs px-2 py-0.5 rounded-full tracking-widest uppercase">
              {badgeLabel}
            </span>
          )}
          <button
            className="p-1.5 rounded-full bg-bg/90 backdrop-blur-sm text-ink-muted hover:text-red-500 transition-colors pointer-events-auto"
            onClick={handleWishlist}
            aria-label="Toggle wishlist"
          >
            <Heart
              className={cn('h-4 w-4', isWishlisted && 'fill-red-500 text-red-500')}
            />
          </button>
        </div>

        {/* Bottom CTAs — always visible on touch/mobile, slide up on hover on desktop */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 flex flex-col gap-1.5 p-3 transition-all duration-300 pointer-events-auto',
            // On mobile (touch): always visible. On md+: hover-controlled
            'md:translate-y-4 md:opacity-0',
            hovered && 'md:translate-y-0 md:opacity-100'
          )}
        >
          <button
            onClick={handleAddToCart}
            className="flex items-center justify-center gap-2 w-full py-2 bg-deep-teal text-cream text-xs font-medium uppercase tracking-widest rounded-md hover:bg-teal transition-colors"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Add to Cart
          </button>
          <button
            type="button"
            className="hidden md:flex items-center justify-center gap-2 w-full py-2 bg-bg/90 backdrop-blur-sm text-ink text-xs font-medium uppercase tracking-widest rounded-md hover:bg-surface transition-colors"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(productHref) }}
          >
            <Eye className="h-3.5 w-3.5" />
            View Product
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 space-y-1.5">
        {/* Tags */}
        <div className="flex gap-1.5 flex-wrap">
          {product.collectionName && (
            <span className="text-2xs px-2 py-0.5 bg-light-teal/30 text-teal rounded-full">
              {product.collectionName}
            </span>
          )}
          {product.categoryName && (
            <span className="text-2xs px-2 py-0.5 bg-cream text-sand rounded-full">
              {product.categoryName}
            </span>
          )}
        </div>

        <p className="font-display text-lg text-ink leading-tight line-clamp-2 group-hover:text-deep-teal transition-colors">
          {product.name}
        </p>

        {product.avgRating != null && (
          <StarRating rating={product.avgRating} count={product.reviewCount} />
        )}

        <p className="text-base font-medium text-deep-teal">
          {displayPrice > 0 ? `From ${formatINR(displayPrice)}` : 'Price on request'}
        </p>
      </div>
    </Link>
  )
}
