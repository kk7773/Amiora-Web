import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'
import { createUserSupabase } from '@/lib/supabase/server-user'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── GET: tab slugs for an admin ───────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const ac     = adminClient()

  const { data: rows, error } = await ac
    .from('admin_tab_permissions')
    .select('cms_tabs ( slug )')
    .eq('admin_id', id)

  if (error) {
    if (error.message?.includes('relation') || error.code === '42P01' || error.code === 'PGRST205') {
      const { data: old, error: o } = await ac
        .from('cms_admin_permissions')
        .select('tab_slug')
        .eq('user_id', id)
      if (o) return NextResponse.json({ error: o.message }, { status: 500 })
      return NextResponse.json({ tabs: (old ?? []).map(r => (r as { tab_slug: string }).tab_slug) })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const nested = (rows ?? []) as { cms_tabs?: { slug?: string } }[]
  const tabs   = nested.map(r => r.cms_tabs?.slug).filter((s): s is string => typeof s === 'string')
  return NextResponse.json({ tabs })
}

// ── PUT: replace tab grants (slugs → cms_tabs ids) ────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id }   = await params
  const { tabs } = await req.json() as { tabs?: string[] }
  const ac       = adminClient()
  const ctx      = await createUserSupabase()
  const { data: { user: actor } } = await ctx.auth.getUser()

  const { error: d1 } = await ac.from('admin_tab_permissions').delete().eq('admin_id', id)
  if (d1 && !d1.message?.includes('relation')) {
    return NextResponse.json({ error: d1.message }, { status: 500 })
  }

  const { error: d0 } = await ac.from('cms_admin_permissions').delete().eq('user_id', id)
  if (d0 && !d0.message?.includes('relation')) {
    /* optional old table */
  }

  const list = Array.isArray(tabs) ? tabs : []
  if (list.length === 0) {
    return NextResponse.json({ success: true, tabs: [] })
  }

  const { data: tabRows, error: te } = await ac.from('cms_tabs').select('id, slug').in('slug', list)
  if (te) {
    if (te.message?.includes('relation') || te.code === '42P01') {
      const { error: insErr } = await ac
        .from('cms_admin_permissions')
        .insert(list.map(tab_slug => ({ user_id: id, tab_slug })))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      return NextResponse.json({ success: true, tabs: list })
    }
    return NextResponse.json({ error: te.message }, { status: 500 })
  }

  const actorId = actor?.id ?? null
  const inserts   = (tabRows ?? []).map(t => ({
    admin_id:    id,
    tab_id:      t.id,
    can_view:    true,
    can_edit:    true,
    assigned_by: actorId,
  }))

  if (inserts.length) {
    const { error: ie } = await ac.from('admin_tab_permissions').insert(inserts)
    if (ie) return NextResponse.json({ error: ie.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, tabs: list })
}
