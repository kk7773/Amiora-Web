import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function GET() {
  const perm = await requireCmsAccess('stores', 'view')
  if (perm.ok === false) return perm.response
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('stores', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const supabase = createServerClient()
    const body = await req.json()

    const dbRow = {
      name:      body.name,
      address:   body.address   ?? null,
      city:      body.city      ?? null,
      state:     body.state     ?? null,
      pincode:   body.pincode   ?? null,
      phone:     body.phone     ?? null,
      email:     body.email     ?? null,
      lat:       body.lat       ? Number(body.lat)  : null,
      lng:       body.lng       ? Number(body.lng)  : null,
      image_url: body.image_url ?? null,
      timings:   body.timings   ?? null,
      is_active: body.is_active ?? true,
    }

    const { data, error } = await supabase
      .from('stores')
      .insert(dbRow)
      .select()
      .single()

    if (error) {
      console.error('[POST /api/stores]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await writeAuditLog({ adminId: perm.adminId, action: 'create_store', resource: 'stores', resourceId: data.id })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
