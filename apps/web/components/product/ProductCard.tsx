'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@amiora/ui'
import { StarRating } from '@/components/ui/StarRating'
import { useCartStore } from '@/stores/cartStore'
import { formatINR } from '@/lib/pricing/calculator'

interface ProductCardImage {
  url: string
  alt_text: string | null
  is_primary: boolean
  is_hover: boolean
}

interface ProductCardVariant {
  id: string
  purity: string
  weight_grams: number | null
  gem_price_override: number | null
  stock_status: string
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?: number | null
}

export interface ProductCardProps {
  product: {
    id: string
    name: string
    slug: string
    making_charge_pct: number
    making_charge_discount_pct?: number | null
    gem_price_discount_pct?: number | null
    product_images: ProductCardImage[]
    product_variants: ProductCardVariant[]
    /** computed live price — pass from server or pricing hook */
    basePrice?: number
    /** Effective % off vs undiscounted total; from `attachCardPrice` */
    discountPercentOff?: number | null
    avgRating?: number
    reviewCount?: number
    collectionName?: string | null
    categoryName?: string | null
  }
  badgeLabel?: string
  className?: string
}

export function ProductCard({ product, badgeLabel, className }: ProductCardProps) {
  const [hovered,  setHovered]  = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const addItem  = useCartStore((s) => s.addItem)
  const router   = useRouter()

  const primaryImage = product.product_images.find((i) => i.is_primary)
    ?? product.product_images[0]
  const hoverImage   = product.product_images.find((i) => i.is_hover)
    ?? product.product_images[1]
    ?? primaryImage

  const displayImg = hovered && hoverImage ? hoverImage : primaryImage

  const firstVariant  = product.product_variants.find((v) => v.stock_status !== 'out_of_stock')
    ?? product.product_variants[0]
  const displayPrice  = product.basePrice ?? 0
  const inStock       = firstVariant?.stock_status !== 'out_of_stock'

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!firstVariant) return
    addItem({
      productId:    product.id,
      variantId:    firstVariant.id,
      sizeLabel:    '',
      productName:  product.name,
      variantLabel: firstVariant.purity,
      imageUrl:     primaryImage?.url ?? '',
      unitPrice:    displayPrice,
      quantity:     1,
    })
    toast.success('Added to cart', { description: product.name })
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    setWishlisted((v) => !v)
    toast(wishlisted ? 'Removed from wishlist' : 'Added to wishlist', {
      icon: wishlisted ? '💔' : '❤️',
    })
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn('group block', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image container */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface">
        {displayImg ? (
          <Image
            src={displayImg.url}
            alt={displayImg.alt_text ?? product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
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
              className={cn('h-4 w-4', wishlisted && 'fill-red-500 text-red-500')}
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
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/products/${product.slug}`) }}
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
