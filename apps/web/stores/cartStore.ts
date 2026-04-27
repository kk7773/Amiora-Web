import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  productId:    string
  variantId:    string
  sizeLabel:    string
  productName:  string
  variantLabel: string
  imageUrl:     string
  unitPrice:    number
  quantity:     number
}

interface CartStore {
  items: CartItem[]
  addItem:        (item: CartItem) => void
  removeItem:     (productId: string, variantId: string) => void
  updateQuantity: (productId: string, variantId: string, qty: number) => void
  clearCart:      () => void
  total:          () => number
  itemCount:      () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
  items: [],

  addItem(item) {
    set((state) => {
      const existing = state.items.findIndex(
        (i) => i.productId === item.productId && i.variantId === item.variantId
      )
      if (existing >= 0) {
        const items = [...state.items]
        items[existing] = {
          ...items[existing]!,
          quantity:  Math.min((items[existing]!.quantity) + item.quantity, 5),
          unitPrice: item.unitPrice,
        }
        return { items }
      }
      return { items: [...state.items, item] }
    })
  },

  removeItem(productId, variantId) {
    set((state) => ({
      items: state.items.filter(
        (i) => !(i.productId === productId && i.variantId === variantId)
      ),
    }))
  },

  updateQuantity(productId, variantId, qty) {
    if (qty <= 0) {
      get().removeItem(productId, variantId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity: Math.min(qty, 5) }
          : i
      ),
    }))
  },

  clearCart() {
    set({ items: [] })
  },

  total() {
    return get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  },

  itemCount() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0)
  },
}),
    {
      name: 'amiora-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
)

/**
 * True after the persist layer has rehydrated on the client.
 * Initial state is always `false` (even if zustand has already rehydrated) so the first
 * client render matches the server and avoids header/cart count hydration mismatches.
 */
export function useCartHydrated() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) {
      setOk(true)
    }
    return useCartStore.persist.onFinishHydration(() => {
      setOk(true)
    })
  }, [])
  return ok
}
