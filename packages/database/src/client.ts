import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
let browserClientSingleton: ReturnType<typeof createClient> | null = null

/**
 * Browser/client-side Supabase client — uses anon key, respects RLS.
 */
export function createBrowserClient() {
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  if (!browserClientSingleton) {
    browserClientSingleton = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  return browserClientSingleton
}

/**
 * Server-side Supabase client — uses service role key, bypasses RLS.
 * Only use in server components, API routes, or server actions.
 */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export type SupabaseClient = ReturnType<typeof createBrowserClient>
export type SupabaseServerClient = ReturnType<typeof createServerClient>
