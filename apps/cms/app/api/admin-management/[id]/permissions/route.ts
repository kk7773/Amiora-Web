import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'
import { createUserSupabase } from '@/lib/supabase/server-user'
import { writeAuditLog } from '@/lib/rbac'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export interface TabPermission {
  slug:     string
  can_view: boolean
  can_edit: boolean
}

// ── GET: tab permissions for an admin ────────────────────────────────────────
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
    .select('can_view, can_edit, cms_tabs ( slug )')
    .eq('admin_id', id)

  if (error) {
    if (error.message?.includes('relation') || error.code === '42P01' || error.code === 'PGRST205') {
      const { data: old, error: o } = await ac
        .from('cms_admin_permissions')
        .select('tab_slug')
        .eq('user_id', id)
      if (o) return NextResponse.json({ error: o.message }, { status: 500 })
      // Legacy: return as TabPermission array with both flags true
      const tabs: TabPermission[] = (old ?? []).map(r => ({
        slug:     (r as { tab_slug: string }).tab_slug,
        can_view: true,
        can_edit: true,
      }))
      return NextResponse.json({ tabs })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const nested = (rows ?? []) as { can_view: boolean; can_edit: boolean; cms_tabs?: { slug?: string } }[]
  const tabs: TabPermission[] = nested
    .filter(r => typeof r.cms_tabs?.slug === 'string')
    .map(r => ({
      slug:     r.cms_tabs!.slug!,
      can_view: r.can_view,
      can_edit: r.can_edit,
    }))

  return NextResponse.json({ tabs })
}

// ── PUT: replace tab grants with per-tab can_view/can_edit ────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id }   = await params
  const body     = await req.json() as { tabs?: TabPermission[] | string[] }
  const ac       = adminClient()
  const ctx      = await createUserSupabase()
  const { data: { user: actor } } = await ctx.auth.getUser()

  // Normalise: accept both old string[] format and new TabPermission[] format
  const rawTabs = Array.isArray(body.tabs) ? body.tabs : []
  const tabList: TabPermission[] = rawTabs.map(t =>
    typeof t === 'string'
      ? { slug: t, can_view: true, can_edit: true }
      : t
  )

  // Clear existing grants from both tables
  const { error: d1 } = await ac.from('admin_tab_permissions').delete().eq('admin_id', id)
  if (d1 && !d1.message?.includes('relation')) {
    return NextResponse.json({ error: d1.message }, { status: 500 })
  }
  await ac.from('cms_admin_permissions').delete().eq('user_id', id)

  if (tabList.length === 0) {
    await writeAuditLog({
      adminId:    actor?.id ?? null,
      action:     'update_permissions',
      resource:   'admin-management',
      resourceId: id,
      meta:       { tabs: [] },
    })
    return NextResponse.json({ success: true, tabs: [] })
  }

  const slugs = tabList.map(t => t.slug)
  const { data: tabRows, error: te } = await ac.from('cms_tabs').select('id, slug').in('slug', slugs)

  if (te) {
    if (te.message?.includes('relation') || te.code === '42P01') {
      // Legacy fallback
      const { error: insErr } = await ac
        .from('cms_admin_permissions')
        .insert(slugs.map(tab_slug => ({ user_id: id, tab_slug })))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      return NextResponse.json({ success: true, tabs: tabList })
    }
    return NextResponse.json({ error: te.message }, { status: 500 })
  }

  const actorId     = actor?.id ?? null
  const slugToPerms = new Map(tabList.map(t => [t.slug, t]))

  const inserts = (tabRows ?? []).map(t => {
    const p = slugToPerms.get(t.slug) ?? { can_view: true, can_edit: true }
    return {
      admin_id:    id,
      tab_id:      t.id,
      can_view:    p.can_view,
      can_edit:    p.can_edit,
      assigned_by: actorId,
    }
  })

  if (inserts.length) {
    const { error: ie } = await ac.from('admin_tab_permissions').insert(inserts)
    if (ie) return NextResponse.json({ error: ie.message }, { status: 500 })
  }

  await writeAuditLog({
    adminId:    actorId,
    action:     'update_permissions',
    resource:   'admin-management',
    resourceId: id,
    meta:       { tabs: tabList },
  })

  return NextResponse.json({ success: true, tabs: tabList })
}
