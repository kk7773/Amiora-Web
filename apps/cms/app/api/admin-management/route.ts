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

// ── GET: list CMS operators from public.profiles ─────────────────────────
export async function GET() {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ac  = adminClient()
  const { data: rows, error } = await ac
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_at, created_by')
    .in('role', ['super_admin', 'admin'])
    .order('created_at', { ascending: false })

  if (error) {
    // Table missing: fall back to auth list (legacy)
    if (error.message?.includes('relation') || error.code === '42P01' || error.code === 'PGRST205') {
      const { data, error: le } = await ac.auth.admin.listUsers()
      if (le) return NextResponse.json({ error: le.message }, { status: 500 })
      const admins = (data?.users ?? [])
        .filter(u => ['super_admin', 'admin'].includes(u.user_metadata?.cms_role))
        .map(u => ({
          id:         u.id,
          email:      u.email,
          name:       u.user_metadata?.full_name ?? u.email,
          cms_role:   u.user_metadata?.cms_role,
          is_active:  !u.banned_until,
          created_at: u.created_at,
        }))
      return NextResponse.json({ data: admins })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const data = (rows ?? []).map(r => ({
    id:         r.id,
    email:      r.email,
    name:       r.full_name ?? r.email,
    cms_role:   r.role,
    is_active:  r.is_active,
    created_at: r.created_at,
  }))

  return NextResponse.json({ data })
}

// ── POST: create auth user + profile row (admin, no tab grants) ───────────
export async function POST(req: NextRequest) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const name  = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const pass  = String(body.password ?? '')

  if (!name || !email || !pass) {
    return NextResponse.json({ error: 'name, email and password are required' }, { status: 400 })
  }
  if (pass.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const uctx = await createUserSupabase()
  const { data: { user: actor } } = await uctx.auth.getUser()

  const ac = adminClient()
  const { data: created, error } = await ac.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role:      'admin',
      cms_role:  'admin',
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uid = created.user.id
  if (!created.user.email_confirmed_at) {
    const { error: fixErr } = await ac.auth.admin.updateUserById(uid, { email_confirm: true })
    if (fixErr) {
      return NextResponse.json(
        { error: `User created but email confirmation failed: ${fixErr.message}.` },
        { status: 500 }
      )
    }
  }

  const { error: pErr } = await ac.from('profiles').insert({
    id:          uid,
    email,
    full_name:   name,
    role:        'admin',
    is_active:   true,
    created_by:  actor?.id ?? null,
  })

  if (pErr) {
    if (pErr.message?.includes('relation') || pErr.code === '42P01') {
      // Migration 008 not applied: profile optional
    } else {
      return NextResponse.json(
        { error: `Auth user created but profile insert failed: ${pErr.message}. Add migration 008 or fix DB.` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    data: {
      id:        uid,
      email:     created.user.email,
      name,
      cms_role:  'admin',
      is_active: true,
    }
  }, { status: 201 })
}
