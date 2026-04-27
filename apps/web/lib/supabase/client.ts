import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

let browserSingleton: ReturnType<typeof createSSRBrowserClient> | null = null

/**
 * Reuse one Supabase client in the browser to avoid "Multiple GoTrueClient instances" warnings
 * and odd auth races when every component called `createBrowserClient()` separately.
 * Server / non-DOM: still return a new instance (no shared global in SSR).
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (typeof window === 'undefined') {
    return createSSRBrowserClient(url, key)
  }
  if (!browserSingleton) {
    browserSingleton = createSSRBrowserClient(url, key)
  }
  return browserSingleton
}
