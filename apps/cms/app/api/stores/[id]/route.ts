import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('stores', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const { id } = await params
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
      .update(dbRow)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/stores]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await writeAuditLog({ adminId: perm.adminId, action: 'update_store', resource: 'stores', resourceId: id })
    return NextResponse.json({ data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('stores', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { error } = await supabase.from('stores').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeAuditLog({ adminId: perm.adminId, action: 'delete_store', resource: 'stores', resourceId: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
