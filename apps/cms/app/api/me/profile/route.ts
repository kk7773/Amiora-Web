import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { cookies } from 'next/headers'
import { isListedSuperAdminEmail } from '@/lib/cmsSuperAdmins'
import { createUserSupabase } from '@/lib/supabase/server-user'

const HARDCODED_COOKIE_NAME  = 'amiora_admin_session'
const HARDCODED_COOKIE_VALUE = 'amiora-admin-authenticated-2024'

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()

  if (cookieStore.get(HARDCODED_COOKIE_NAME)?.value === HARDCODED_COOKIE_VALUE) {
    return NextResponse.json({
      name: 'Super Admin',
      email: '—',
      cms_role: 'super_admin',
      tabs: null,
      joined_at: null,
    })
  }

  const supa = await createUserSupabase()
  const { data: { user }, error } = await supa.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const joinedAt = user.created_at ?? null

  if (isListedSuperAdminEmail(user.email)) {
    const name = user.user_metadata?.full_name ?? user.email ?? 'Admin'
    const email = user.email ?? '—'
    return NextResponse.json({ name, email, cms_role: 'super_admin', tabs: null, joined_at: joinedAt })
  }

  const { data: prof } = await supa
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (prof?.role === 'super_admin') {
    return NextResponse.json({
      name:  prof.full_name ?? user.email ?? 'Admin',
      email: prof.email ?? user.email ?? '—',
      cms_role: 'super_admin',
      tabs: null,
      joined_at: joinedAt,
    })
  }

  if (prof?.role === 'admin') {
    const { data: rows } = await supa
      .from('admin_tab_permissions')
      .select('cms_tabs ( slug )')
      .eq('admin_id', user.id)
    const nested = (rows ?? []) as { cms_tabs?: { slug?: string } }[]
    const tabs = nested.map(r => r.cms_tabs?.slug).filter((s): s is string => typeof s === 'string')
    return NextResponse.json({
      name:  prof.full_name ?? user.email ?? 'Admin',
      email: prof.email ?? user.email ?? '—',
      cms_role: 'admin',
      tabs,
      joined_at: joinedAt,
    })
  }

  // Legacy
  const supabase = createServerClient()
  const name  = user.user_metadata?.full_name ?? user.email ?? 'Admin'
  const email = user.email ?? '—'
  const cmsRole: string = user.user_metadata?.cms_role ?? 'admin'

  if (cmsRole === 'super_admin') {
    return NextResponse.json({ name, email, cms_role: 'super_admin', tabs: null, joined_at: joinedAt })
  }

  const { data, error: permErr } = await supabase
    .from('cms_admin_permissions')
    .select('tab_slug')
    .eq('user_id', user.id)

  if (permErr) return NextResponse.json({ error: permErr.message }, { status: 500 })

  return NextResponse.json({
    name,
    email,
    cms_role: cmsRole,
    tabs: (data ?? []).map(r => (r as { tab_slug: string }).tab_slug),
    joined_at: joinedAt,
  })
}
