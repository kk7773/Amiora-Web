import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'
import { writeAuditLog } from '@/lib/rbac'
import { createUserSupabase } from '@/lib/supabase/server-user'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getActorId(): Promise<string | null> {
  try {
    const ctx = await createUserSupabase()
    const { data: { user } } = await ctx.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

// ── PATCH: update admin name and/or is_active ─────────────────────────────
// Body can include: { name?: string, is_active?: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id }  = await params
  const body    = await req.json()
  const admin   = adminClient()
  const actorId = await getActorId()

  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(id)
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 })

  // ── Name update ───────────────────────────────────────────────────────
  if (body.name !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      user_metadata: {
        ...(existing.user.user_metadata as Record<string, unknown> | undefined),
        full_name: String(body.name).trim(),
      },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin
      .from('profiles')
      .update({ full_name: String(body.name).trim() })
      .eq('id', id)

    await writeAuditLog({
      adminId:    actorId,
      action:     'update_admin_name',
      resource:   'admin-management',
      resourceId: id,
    })
  }

  // ── Enable / disable toggle ───────────────────────────────────────────
  if (body.is_active !== undefined) {
    const isActive = Boolean(body.is_active)

    if (actorId && actorId === id && !isActive) {
      return NextResponse.json({ error: 'You cannot disable your own super admin account.' }, { status: 400 })
    }

    const { error: pErr } = await admin
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', id)

    if (pErr && !pErr.message?.includes('relation') && pErr.code !== '42P01') {
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    await writeAuditLog({
      adminId:    actorId,
      action:     isActive ? 'enable_admin' : 'disable_admin',
      resource:   'admin-management',
      resourceId: id,
    })
  }

  return NextResponse.json({ success: true })
}

// ── PUT: reset admin password ─────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id }       = await params
  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const ac = adminClient()
  const { error } = await ac.auth.admin.updateUserById(id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const actorId = await getActorId()
  await writeAuditLog({
    adminId:    actorId,
    action:     'reset_admin_password',
    resource:   'admin-management',
    resourceId: id,
  })

  return NextResponse.json({ success: true })
}

// ── DELETE: remove admin (auth user; profiles + perms cascade) ────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const ac     = adminClient()
  const actorId = await getActorId()

  if (actorId && actorId === id) {
    return NextResponse.json({ error: 'You cannot delete your own super admin account.' }, { status: 400 })
  }

  await ac.from('cms_admin_permissions').delete().eq('user_id', id)

  const { error } = await ac.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    adminId:    actorId,
    action:     'delete_admin',
    resource:   'admin-management',
    resourceId: id,
  })

  return NextResponse.json({ success: true })
}
