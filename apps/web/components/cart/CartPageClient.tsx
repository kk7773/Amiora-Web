'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Heart, ShoppingBag, ArrowRight, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCartStore, useCartHydrated } from '@/stores/cartStore'
import { formatINR }    from '@/lib/pricing/calculator'
import { getCartItemHref } from '@/lib/shop/paths'
import { ProductCard, type ProductCardProps } from '@/components/product/ProductCard'
import { Skeleton }     from '@/components/ui/Skeleton'
import { fadeUp, stagger } from '@/lib/animations'

export function CartPageClient() {
  const cartHydrated = useCartHydrated()
  const { items, removeItem, updateQuantity, total, clearCart } = useCartStore()
  const [suggestions, setSuggestions] = useState<ProductCardProps['product'][]>([])
  const [sugLoading,  setSugLoading]  = useState(false)

  // Fetch smart suggestions
  useEffect(() => {
    if (!items.length) return
    setSugLoading(true)
    fetch('/api/products/smart-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_ids: items.map((i) => i.productId) }),
    })
      .then((r) => r.json())
      .then((d: { products: ProductCardProps['product'][] }) => {
        setSuggestions(d.products ?? [])
        setSugLoading(false)
      })
      .catch(() => setSugLoading(false))
  }, [items.length])

  const subtotal  = total()
  const shipping  = subtotal >= 5000 ? 0 : 199
  const grandTotal = subtotal + shipping

  if (!cartHydrated) {
    return (
      <div className="section-x py-10">
        <h1 className="font-display text-display-xl text-ink mb-8">Shopping Cart</h1>
        <div className="flex min-h-[200px] items-center justify-center text-ink-muted text-sm">Loading your bag…</div>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="section-x py-24 text-center">
        <div className="mx-auto max-w-sm space-y-6">
          <ShoppingBag className="mx-auto h-16 w-16 text-ink-faint" />
          <h1 className="font-display text-2xl text-ink">Your cart is empty</h1>
          <p className="text-sm text-ink-muted">Add some beautiful jewellery to get started.</p>
          <Link
            href="/shop"
            className="inline-block bg-deep-teal text-cream px-8 py-3 text-sm uppercase tracking-widest rounded-md hover:bg-teal transition-colors"
          >
            Shop Now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="section-x py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-display-xl text-ink">Shopping Cart</h1>
        <button
          onClick={() => { clearCart(); toast.info('Cart cleared') }}
          className="text-xs text-ink-faint hover:text-red-500 transition-colors"
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Cart items */}
        <div>
          <motion.ul
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="divide-y divide-divider"
          >
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const productHref = getCartItemHref(item)
                return (
                <motion.li
                  key={`${item.productId}-${item.variantId}`}
                  variants={fadeUp}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  className="flex gap-5 py-6"
                >
                  {/* Image */}
                  <Link href={productHref} className="relative h-24 w-24 shrink-0 rounded-lg overflow-hidden bg-surface">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="96px" />
                    ) : (
                      <div className="h-full bg-gradient-to-br from-light-teal/20 to-cream" />
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={productHref} className="font-display text-base text-ink hover:text-deep-teal transition-colors line-clamp-2">
                        {item.productName}
                      </Link>
                      <button
                        onClick={() => { removeItem(item.productId, item.variantId); toast.success('Removed from cart') }}
                        className="p-1 text-ink-faint hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="text-xs text-ink-muted">{item.variantLabel}</p>
                    {item.sizeLabel && <p className="text-xs text-ink-muted">Size: {item.sizeLabel}</p>}

                    <div className="mt-auto flex items-center justify-between gap-4 flex-wrap">
                      {/* Qty stepper */}
                      <div className="flex items-center gap-2 border border-divider rounded-md overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                          className="px-2.5 py-1.5 text-ink-muted hover:text-deep-teal transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                          className="px-2.5 py-1.5 text-ink-muted hover:text-deep-teal transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <p className="font-semibold text-deep-teal">{formatINR(item.unitPrice * item.quantity)}</p>

                      <button className="flex items-center gap-1 text-xs text-ink-muted hover:text-teal transition-colors">
                        <Heart className="h-3.5 w-3.5" /> Save
                      </button>
                    </div>
                  </div>
                </motion.li>
                )
              })}
            </AnimatePresence>
          </motion.ul>
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="bg-surface rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg text-ink">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <SummaryRow label="Subtotal" value={formatINR(subtotal)} />
              <SummaryRow
                label="Shipping"
                value={shipping === 0 ? 'FREE' : formatINR(shipping)}
                highlight={shipping === 0}
              />
              {shipping > 0 && (
                <p className="text-xs text-teal">Add {formatINR(5000 - subtotal)} more for free shipping</p>
              )}
            </div>

            <div className="border-t border-divider pt-4">
              <SummaryRow label="Total" value={formatINR(grandTotal)} bold />
              <p className="text-xs text-ink-faint mt-1">Incl. all applicable taxes</p>
            </div>

            <Link
              href="/checkout"
              className="flex items-center justify-center gap-2 w-full py-4 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal transition-colors"
            >
              Proceed to Checkout <ArrowRight className="h-4 w-4" />
            </Link>

            <Link href="/shop" className="block text-center text-xs text-teal hover:text-deep-teal transition-colors">
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      {/* Smart suggestions */}
      {(suggestions.length > 0 || sugLoading) && (
        <div className="mt-16">
          <h2 className="font-display text-display-xl text-ink mb-8">You Might Also Like</h2>
          <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
            {sugLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-square w-full" rounded="lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              : suggestions.slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold text-ink' : 'text-ink-muted'}`}>
      <span>{label}</span>
      <span className={highlight ? 'text-teal font-medium' : ''}>{value}</span>
    </div>
  )
}
