/**
 * Verifies that the anon key JWT `ref` claim matches the project ref in the Supabase URL.
 * Mismatched copy-paste (URL from one project, key from another) → "Invalid API key" from Supabase.
 */
export function getProjectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname
    const m    = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

function decodeJwtPayload<T extends Record<string, unknown>>(jwt: string): T | null {
  try {
    const parts = jwt.split('.')
    if (parts.length < 2) return null
    const b64   = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json  = atob(p64Pad(b64))
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

function p64Pad(s: string) {
  const pad = s.length % 4
  return pad ? s + '='.repeat(4 - pad) : s
}

export function getRefFromAnonKey(anonKey: string): string | null {
  const p = decodeJwtPayload<{ ref?: string }>(anonKey)
  return p?.ref ?? null
}

export function describeSupabasePublicEnvIssue(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    return 'Supabase is not configured: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to apps/cms/.env.local (see .env.example), then restart the dev server.'
  }
  const urlRef = getProjectRefFromSupabaseUrl(url)
  const keyRef = getRefFromAnonKey(key)
  if (urlRef && keyRef && urlRef !== keyRef) {
    return `URL and anon key are for different projects (URL: ${urlRef} · key: ${keyRef}). In Supabase → Project Settings → API, copy the Project URL and the anon public key from the same project into apps/cms/.env.local, then restart npm run dev.`
  }
  return null
}

/** True when URL + anon key exist, match the same project, and the browser can call Supabase safely. */
export function isSupabasePublicEnvOk(): boolean {
  return describeSupabasePublicEnvIssue() === null
}
