import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createServerClient } from '@amiora/database'
import { fetchSearchSuggestions, type SearchSuggestionLite } from '@/lib/search/fetchSearchSuggestions'

export type SearchSuggestion = SearchSuggestionLite

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
}

function getCachedSuggestions(q: string, limit: number) {
  return unstable_cache(
    async () => {
      const supabase = createServerClient()
      return fetchSearchSuggestions(supabase, q, limit)
    },
    ['search-suggest', q.toLowerCase(), String(limit)],
    { revalidate: 60 },
  )()
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(10, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '8', 10) || 8))

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] satisfies SearchSuggestion[] }, { headers: CACHE_HEADERS })
  }

  try {
    const suggestions = await getCachedSuggestions(q, limit)
    return NextResponse.json({ suggestions }, { headers: CACHE_HEADERS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
