'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, ShoppingBag } from 'lucide-react'
import { ProductCard, type ProductCardProps } from '@/components/product/ProductCard'
import { useCartStore } from '@/stores/cartStore'
import { createBrowserClient } from '@amiora/database'

interface WishlistGridProps {
  products: ProductCardProps['product'][]
}

export function WishlistGrid({ products: initialProducts }: WishlistGridProps) {
  const [products, setProducts] = useState(initialProducts)
  const addItem = useCartStore((s) => s.addItem)

  const handleRemove = async (productId: string) => {
    const supabase = createBrowserClient()
    await supabase.from('wishlists').delete().eq('product_id', productId)
    setProducts((prev) => prev.filter((p) => p.id !== productId))
    toast.success('Removed from wishlist')
  }

  const handleAddToCart = (product: ProductCardProps['product']) => {
    const variant = product.product_variants?.[0]
    if (!variant) return
    addItem({
      productId:    product.id,
      variantId:    variant.id,
      variantSku:   variant.sku,
      sizeLabel:    '',
      productName:  product.name,
      variantLabel: variant.sku,
      imageUrl:     product.product_images?.find((i) => i.is_primary)?.url ?? '',
      unitPrice:    product.basePrice ?? 0,
      quantity:     1,
      productSlug:  product.slug,
      collectionSlug: product.collectionSlug ?? null,
      categorySlug:   product.categorySlug ?? null,
    })
    toast.success('Added to cart')
  }

  return (
    <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div key={product.id} className="relative">
          <ProductCard product={product} />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <button
              onClick={() => handleAddToCart(product)}
              className="p-1.5 bg-deep-teal/90 text-cream rounded-full hover:bg-teal transition-colors"
              title="Add to cart"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleRemove(product.id)}
              className="p-1.5 bg-bg/90 text-ink-muted rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
