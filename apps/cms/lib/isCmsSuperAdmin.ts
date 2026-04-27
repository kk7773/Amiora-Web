import { cookies } from 'next/headers'
import { createUserSupabase } from '@/lib/supabase/server-user'
import { isListedSuperAdminEmail } from '@/lib/cmsSuperAdmins'

const HARDCODED_COOKIE_NAME  = 'amiora_admin_session'
const HARDCODED_COOKIE_VALUE = 'amiora-admin-authenticated-2024'

/** True for hardcoded cookie, allowlisted email, profile.super_admin, or legacy metadata. */
export async function isCmsSuperAdminApi(): Promise<boolean> {
  const store = await cookies()
  if (store.get(HARDCODED_COOKIE_NAME)?.value === HARDCODED_COOKIE_VALUE) return true

  const supa = await createUserSupabase()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return false
  if (isListedSuperAdminEmail(user.email)) return true

  const { data: p } = await supa
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (p?.role === 'super_admin') return true
  if (!p) {
    // Legacy
    return user.user_metadata?.cms_role === 'super_admin'
  }
  return false
}
