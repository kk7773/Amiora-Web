'use client'

import { useWishlistContext } from '@/components/providers/WishlistProvider'

/** Batch wishlist lookup — one fetch for all product cards on the page. */
export function useWishlistIds(productId: string, variantId?: string | null) {
  const ctx = useWishlistContext()

  if (!ctx) {
    return {
      isWishlisted: false,
      toggle: async (_e?: React.MouseEvent) => {},
      busy: false,
      ready: false,
    }
  }

  return {
    isWishlisted: ctx.wishlistedIds.has(productId),
    toggle: (e?: React.MouseEvent) => ctx.toggle(productId, variantId, e),
    busy: ctx.busyId === productId,
    ready: ctx.ready,
  }
}
