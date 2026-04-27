import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── PATCH: update admin name (auth + profiles) ─────────────────────────────
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

  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(id)
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 })

  const updates: { user_metadata?: Record<string, unknown> } = {}
  if (body.name !== undefined) {
    updates.user_metadata = {
      ...(existing.user.user_metadata as Record<string, unknown> | undefined),
      full_name: String(body.name).trim(),
    }
  }

  const { error } = await admin.auth.admin.updateUserById(id, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.name !== undefined) {
    await admin
      .from('profiles')
      .update({ full_name: String(body.name).trim() })
      .eq('id', id)
  }

  return NextResponse.json({ success: true })
}

// ── PUT: reset admin password ───────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id }     = await params
  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const ac = adminClient()
  const { error } = await ac.auth.admin.updateUserById(id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  const { id }   = await params
  const ac = adminClient()

  await ac.from('cms_admin_permissions').delete().eq('user_id', id)

  const { error } = await ac.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
