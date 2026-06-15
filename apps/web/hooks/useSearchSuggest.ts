'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  fetchSearchSuggestions,
  fetchSearchThumbnails,
  type SearchSuggestionLite,
} from '@/lib/search/fetchSearchSuggestions'

export type SearchSuggestion = SearchSuggestionLite

const DEBOUNCE_MS = 150
const CACHE_TTL_MS = 90_000
const MAX_CACHE = 64

type CacheEntry = {
  suggestions: SearchSuggestion[]
  at: number
}

const queryCache = new Map<string, CacheEntry>()

function normalize(q: string) {
  return q.trim().toLowerCase()
}

function readCache(q: string): SearchSuggestion[] | null {
  const key = normalize(q)
  const hit = queryCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    queryCache.delete(key)
    return null
  }
  return hit.suggestions
}

function writeCache(q: string, suggestions: SearchSuggestion[]) {
  const key = normalize(q)
  if (queryCache.size >= MAX_CACHE) {
    const oldest = [...queryCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) queryCache.delete(oldest[0])
  }
  queryCache.set(key, { suggestions, at: Date.now() })
}

function filterFromPrefixCache(q: string): SearchSuggestion[] | null {
  const key = normalize(q)

  for (const [cachedKey, entry] of queryCache) {
    if (Date.now() - entry.at > CACHE_TTL_MS) continue
    if (!cachedKey.startsWith(key) || cachedKey.length <= key.length) continue

    const filtered = entry.suggestions.filter(
      (s) =>
        s.name.toLowerCase().includes(key) ||
        s.slug.toLowerCase().includes(key) ||
        (s.subtitle?.toLowerCase().includes(key) ?? false),
    )
    if (filtered.length > 0) return filtered.slice(0, 8)
  }

  return null
}

async function loadThumbnails(
  suggestions: SearchSuggestion[],
  signal: AbortSignal,
  isCurrent: () => boolean,
  apply: (next: SearchSuggestion[]) => void,
) {
  const missing = suggestions.filter((s) => !s.imageUrl).map((s) => s.id)
  if (missing.length === 0 || signal.aborted) return

  const supabase = createBrowserClient()
  const thumbs = await fetchSearchThumbnails(supabase, missing)
  if (signal.aborted || !isCurrent()) return

  apply(
    suggestions.map((s) => ({
      ...s,
      imageUrl: thumbs[s.id] ?? s.imageUrl,
    })),
  )
}

export function useSearchSuggest(query: string, debounceMs = DEBOUNCE_MS) {
  const trimmed = query.trim()
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>(() => readCache(trimmed) ?? [])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    if (trimmed.length < 2) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const exact = readCache(trimmed)
    if (exact) {
      setSuggestions(exact)
      setLoading(false)

      const controller = new AbortController()
      const id = ++requestId.current
      void loadThumbnails(exact, controller.signal, () => id === requestId.current, (merged) => {
        writeCache(trimmed, merged)
        setSuggestions(merged)
      })

      return () => controller.abort()
    }

    const prefix = filterFromPrefixCache(trimmed)
    if (prefix) {
      setSuggestions(prefix)
      setLoading(false)
    } else {
      setLoading(true)
    }

    const controller = new AbortController()
    const id = ++requestId.current

    const timer = setTimeout(async () => {
      try {
        const supabase = createBrowserClient()
        const next = await fetchSearchSuggestions(supabase, trimmed, 8)
        if (controller.signal.aborted || id !== requestId.current) return

        writeCache(trimmed, next)
        setSuggestions(next)
        setLoading(false)

        void loadThumbnails(next, controller.signal, () => id === requestId.current, (merged) => {
          writeCache(trimmed, merged)
          setSuggestions(merged)
        })
      } catch {
        if (controller.signal.aborted || id !== requestId.current) return
        if (!prefix) setSuggestions([])
        setLoading(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, debounceMs])

  return { suggestions, loading, show: trimmed.length >= 2 }
}
