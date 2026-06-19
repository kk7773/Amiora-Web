'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'
import { useWishlistContext } from '@/components/providers/WishlistProvider'

function useWishlistFallback(productId: string, variantId: string | null | undefined, enabled: boolean) {
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(!enabled)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const supabase = createBrowserClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return

      if (!user) {
        setUserId(null)
        setIsWishlisted(false)
        setReady(true)
        return
      }

      setUserId(user.id)
      const { data } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle()

      if (!cancelled) {
        setIsWishlisted(!!data)
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
  }, [productId, enabled])

  const toggle = useCallback(
    async (e?: React.MouseEvent) => {
      if (!enabled) return
      e?.preventDefault()
      e?.stopPropagation()

      if (!userId) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '/'
        router.push(`/login?redirect=${encodeURIComponent(path)}`)
        return
      }

      setBusy(true)
      const supabase = createBrowserClient()

      try {
        if (isWishlisted) {
          const { error } = await supabase
            .from('wishlists')
            .delete()
            .eq('user_id', userId)
            .eq('product_id', productId)
          if (error) throw error
          setIsWishlisted(false)
          toast.success('Removed from wishlist')
        } else {
          const { error } = await supabase.from('wishlists').insert({
            user_id: userId,
            product_id: productId,
            variant_id: variantId ?? null,
          })
          if (error) throw error
          setIsWishlisted(true)
          toast.success('Added to wishlist')
        }
      } catch {
        toast.error('Could not update wishlist')
      } finally {
        setBusy(false)
      }
    },
    [enabled, userId, isWishlisted, productId, variantId, router],
  )

  return { isWishlisted, toggle, busy, ready }
}

export function useWishlist(productId: string, variantId?: string | null) {
  const ctx = useWishlistContext()
  const fallback = useWishlistFallback(productId, variantId, !ctx)

  if (ctx) {
    return {
      isWishlisted: ctx.wishlistedIds.has(productId),
      toggle: (e?: React.MouseEvent) => ctx.toggle(productId, variantId, e),
      busy: ctx.busyId === productId,
      ready: ctx.ready,
    }
  }

  return fallback
}
