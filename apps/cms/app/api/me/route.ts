import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { cookies } from 'next/headers'
import { isListedSuperAdminEmail } from '@/lib/cmsSuperAdmins'
import { createUserSupabase } from '@/lib/supabase/server-user'

const HARDCODED_COOKIE_NAME  = 'amiora_admin_session'
const HARDCODED_COOKIE_VALUE = 'amiora-admin-authenticated-2024'

// Returns the current CMS user's role and allowed tab slugs.
export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()

  if (cookieStore.get(HARDCODED_COOKIE_NAME)?.value === HARDCODED_COOKIE_VALUE) {
    return NextResponse.json({ cms_role: 'super_admin', tabs: null })
  }

  const supa = await createUserSupabase()
  const { data: { user }, error: authErr } = await supa.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  if (isListedSuperAdminEmail(user.email)) {
    return NextResponse.json({ cms_role: 'super_admin', tabs: null })
  }

  // ── New RBAC: public.profiles + admin_tab_permissions ─────────────
  const { data: p } = await supa
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (p && p.is_active === false) {
    return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
  }

  if (p?.role === 'super_admin') {
    return NextResponse.json({ cms_role: 'super_admin', tabs: null })
  }

  if (p?.role === 'admin') {
    const { data: rows, error: pe } = await supa
      .from('admin_tab_permissions')
      .select('cms_tabs ( slug )')
      .eq('admin_id', user.id)
    if (!pe) {
      const nested = (rows ?? []) as { cms_tabs?: { slug?: string } }[]
      const tabs = nested
        .map(r => r.cms_tabs?.slug)
        .filter((s): s is string => typeof s === 'string')
      const effectiveTabs = tabs.length === 0 ? null : tabs
      return NextResponse.json({ cms_role: 'admin', tabs: effectiveTabs })
    }
  }

  // ── Legacy: metadata + 007 table (no default “admin” for random users) ─
  const mRole = user.user_metadata?.cms_role
  const uRole = user.user_metadata?.role
  const db    = createServerClient()
  const { data: oldRows, error: oErr } = await db
    .from('cms_admin_permissions')
    .select('tab_slug')
    .eq('user_id', user.id)

  if (oErr) {
    return NextResponse.json({ error: oErr.message }, { status: 500 })
  }
  const oldTabs = (oldRows ?? []) as { tab_slug: string }[]

  if (mRole === 'super_admin') {
    return NextResponse.json({ cms_role: 'super_admin', tabs: null })
  }
  if (mRole === 'admin' || uRole === 'admin' || oldTabs.length > 0) {
    return NextResponse.json({
      cms_role: 'admin',
      tabs:     oldTabs.map(r => r.tab_slug),
    })
  }

  return NextResponse.json({ error: 'Not a CMS user' }, { status: 403 })
}
