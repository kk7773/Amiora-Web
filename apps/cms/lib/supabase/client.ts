import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describeSupabasePublicEnvIssue } from './envMatch'

/** One browser client for the whole CMS tab — avoids “Multiple GoTrueClient instances” warnings. */
let cached: SupabaseClient | null = null

export function createBrowserClient() {
  if (typeof window !== 'undefined' && cached) return cached

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const issue = describeSupabasePublicEnvIssue()
    if (issue) console.error('[Amiora CMS] Supabase env error:\n', issue)
  }

  const client = createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  if (typeof window !== 'undefined') cached = client
  return client
}
