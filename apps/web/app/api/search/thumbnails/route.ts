import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { fetchSearchThumbnails } from '@/lib/search/fetchSearchSuggestions'

const MAX_IDS = 12

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS)

  if (ids.length === 0) {
    return NextResponse.json({ thumbnails: {} as Record<string, string | null> }, { headers: CACHE_HEADERS })
  }

  try {
    const supabase = createServerClient()
    const thumbnails = await fetchSearchThumbnails(supabase, ids)
    return NextResponse.json({ thumbnails }, { headers: CACHE_HEADERS })
  } catch {
    return NextResponse.json({ thumbnails: Object.fromEntries(ids.map((id) => [id, null])) }, { headers: CACHE_HEADERS })
  }
}
