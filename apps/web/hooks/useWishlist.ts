'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

export function useWishlist(productId: string, variantId?: string | null) {
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
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

    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [productId])

  const toggle = useCallback(
    async (e?: React.MouseEvent) => {
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
    [userId, isWishlisted, productId, variantId, router],
  )

  return { isWishlisted, toggle, busy, ready }
}
