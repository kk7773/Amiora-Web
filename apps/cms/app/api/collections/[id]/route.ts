import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (!perm.ok) return perm.response
  const { id } = await params
  const body    = await req.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('collections')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'update_collection', resource: 'collections', resourceId: id })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (!perm.ok) return perm.response
  const { id } = await params
  const supabase = createServerClient()
  // Promote children to top-level before deleting parent
  await supabase.from('collections').update({ parent_id: null }).eq('parent_id', id)
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'delete_collection', resource: 'collections', resourceId: id })
  return NextResponse.json({ success: true })
}
