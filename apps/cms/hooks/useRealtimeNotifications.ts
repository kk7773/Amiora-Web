'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { isSupabasePublicEnvOk } from '@/lib/supabase/envMatch'
import { useNotificationStore } from '@/stores/notificationStore'
import { toast } from 'sonner'

export function useRealtimeNotifications(enabled = true) {
  const addNotification = useNotificationStore(s => s.addNotification)

  useEffect(() => {
    if (!enabled || !isSupabasePublicEnvOk()) return

    let supabase: ReturnType<typeof createBrowserClient>
    try {
      supabase = createBrowserClient()
    } catch {
      return
    }

    const ordersChannel = supabase
      .channel('cms-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const n = { message: `New order #${payload.new.order_number}`, at: new Date().toISOString(), type: 'order' as const }
        addNotification(n)
        toast.info(n.message, { description: `₹${payload.new.total_amount?.toLocaleString()}` })
      })
      .subscribe((status, err) => {
        if (err) console.warn('[Realtime] orders channel error — Supabase Realtime not active yet:', err.message)
      })

    const requestsChannel = supabase
      .channel('cms-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'callback_requests' }, () => {
        const n = { message: 'New callback request', at: new Date().toISOString(), type: 'request' as const }
        addNotification(n)
        toast.info(n.message)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_requests' }, () => {
        const n = { message: 'New demo request', at: new Date().toISOString(), type: 'request' as const }
        addNotification(n)
        toast.info(n.message)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customization_requests' }, () => {
        const n = { message: 'New customization request', at: new Date().toISOString(), type: 'request' as const }
        addNotification(n)
        toast.info(n.message)
      })
      .subscribe((status, err) => {
        if (err) console.warn('[Realtime] requests channel error:', err.message)
      })

    const reviewsChannel = supabase
      .channel('cms-reviews')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, () => {
        const n = { message: 'New review pending moderation', at: new Date().toISOString(), type: 'review' as const }
        addNotification(n)
        toast.info(n.message)
      })
      .subscribe((status, err) => {
        if (err) console.warn('[Realtime] reviews channel error:', err.message)
      })

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(requestsChannel)
      supabase.removeChannel(reviewsChannel)
    }
  }, [addNotification])
}
