'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@amiora/database'
import type { LivePrice } from '@amiora/types'

interface PricesState {
  gold:    LivePrice | null
  silver:  LivePrice | null
  loading: boolean
  error:   string | null
}

let cachedPrices: { gold: LivePrice | null; silver: LivePrice | null } | null = null

const REFRESH_AFTER_MS = 5 * 60 * 1000

type UsePricingOptions = {
  initialGoldPerGram?: number
  initialSilverPerGram?: number
  /** Skip immediate /api/pricing fetch when SSR rates are available */
  deferFetch?: boolean
}

function livePriceFromGram(metal: LivePrice['metal'], pricePerGram: number): LivePrice {
  return {
    id: `ssr-${metal}`,
    metal,
    pricePerGram,
    currency: 'INR',
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * Fetches + caches live gold/silver prices.
 * Subscribes to Supabase Realtime for live updates.
 */
export function usePricing(options?: UsePricingOptions): PricesState {
  const deferFetch = options?.deferFetch ?? false
  const initialGold = options?.initialGoldPerGram != null
    ? livePriceFromGram('gold_999', options.initialGoldPerGram)
    : null
  const initialSilver = options?.initialSilverPerGram != null
    ? livePriceFromGram('silver_999', options.initialSilverPerGram)
    : null

  const [state, setState] = useState<PricesState>(() => ({
    gold:    initialGold ?? cachedPrices?.gold ?? null,
    silver:  initialSilver ?? cachedPrices?.silver ?? null,
    loading: !deferFetch && !cachedPrices && !initialGold,
    error:   null,
  }))
  const supabase = useRef(createBrowserClient())

  useEffect(() => {
    const client = supabase.current

    const fetchPrices = async () => {
      try {
        const res  = await fetch('/api/pricing', { cache: 'no-store' })
        const json = (await res.json()) as { data: { gold: LivePrice; silver: LivePrice } }
        cachedPrices = json.data
        setState({ gold: json.data.gold, silver: json.data.silver, loading: false, error: null })
      } catch {
        setState((s) => ({ ...s, loading: false, error: 'Failed to load live prices' }))
      }
    }

    if (deferFetch && initialGold && initialSilver) {
      cachedPrices = { gold: initialGold, silver: initialSilver }
      const timer = setTimeout(() => {
        void fetchPrices()
      }, REFRESH_AFTER_MS)

      const channel = client
        .channel('live-prices')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_prices' }, (payload) => {
          const row = payload.new as { metal: string; price_per_gram: number; currency: string; fetched_at: string; id: string }
          const price: LivePrice = {
            id: row.id, metal: row.metal as LivePrice['metal'],
            pricePerGram: row.price_per_gram, currency: row.currency, fetchedAt: row.fetched_at,
          }
          setState((s) => {
            const updated = row.metal === 'gold_999'
              ? { ...s, gold: price }
              : { ...s, silver: price }
            cachedPrices = { gold: updated.gold, silver: updated.silver }
            return updated
          })
        })
        .subscribe()

      return () => {
        clearTimeout(timer)
        void client.removeChannel(channel)
      }
    }

    void fetchPrices()

    const channel = client
      .channel('live-prices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_prices' }, (payload) => {
        const row = payload.new as { metal: string; price_per_gram: number; currency: string; fetched_at: string; id: string }
        const price: LivePrice = {
          id: row.id, metal: row.metal as LivePrice['metal'],
          pricePerGram: row.price_per_gram, currency: row.currency, fetchedAt: row.fetched_at,
        }
        setState((s) => {
          const updated = row.metal === 'gold_999'
            ? { ...s, gold: price }
            : { ...s, silver: price }
          cachedPrices = { gold: updated.gold, silver: updated.silver }
          return updated
        })
      })
      .subscribe()

    return () => { void client.removeChannel(channel) }
  }, [deferFetch, initialGold, initialSilver])

  return state
}
