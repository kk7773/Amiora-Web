'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

type WishlistContextValue = {
  wishlistedIds: Set<string>
  ready: boolean
  userId: string | null
  busyId: string | null
  toggle: (productId: string, variantId?: string | null, e?: React.MouseEvent) => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return

      if (!user) {
        setUserId(null)
        setWishlistedIds(new Set())
        setReady(true)
        return
      }

      setUserId(user.id)
      const { data } = await supabase
        .from('wishlists')
        .select('product_id')
        .eq('user_id', user.id)

      if (!cancelled) {
        setWishlistedIds(new Set((data ?? []).map((r) => r.product_id)))
        setReady(true)
      }
    }

    void load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void load()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const toggle = useCallback(
    async (productId: string, variantId?: string | null, e?: React.MouseEvent) => {
      e?.preventDefault()
      e?.stopPropagation()

      if (!userId) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '/'
        router.push(`/login?redirect=${encodeURIComponent(path)}`)
        return
      }

      setBusyId(productId)
      const supabase = createBrowserClient()
      const isWishlisted = wishlistedIds.has(productId)

      try {
        if (isWishlisted) {
          const { error } = await supabase
            .from('wishlists')
            .delete()
            .eq('user_id', userId)
            .eq('product_id', productId)
          if (error) throw error
          setWishlistedIds((prev) => {
            const next = new Set(prev)
            next.delete(productId)
            return next
          })
          toast.success('Removed from wishlist')
        } else {
          const { error } = await supabase.from('wishlists').insert({
            user_id: userId,
            product_id: productId,
            variant_id: variantId ?? null,
          })
          if (error) throw error
          setWishlistedIds((prev) => new Set(prev).add(productId))
          toast.success('Added to wishlist')
        }
      } catch {
        toast.error('Could not update wishlist')
      } finally {
        setBusyId(null)
      }
    },
    [userId, wishlistedIds, router],
  )

  const value = useMemo(
    () => ({ wishlistedIds, ready, userId, busyId, toggle }),
    [wishlistedIds, ready, userId, busyId, toggle],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlistContext() {
  return useContext(WishlistContext)
}
