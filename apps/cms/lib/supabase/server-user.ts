import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client bound to the current browser session (anon key + cookies).
 * Required for `auth.getUser()` and RLS (profiles, RPC `cms_user_has_tab`, etc.).
 */
export async function createUserSupabase() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: cks => {
          try {
            cks.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch { /* read-only in some request contexts */ }
        },
      },
    }
  )
}
