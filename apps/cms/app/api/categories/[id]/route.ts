import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (perm.ok === false) return perm.response
  const { id } = await params
  const body    = await req.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('categories')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'update_category', resource: 'collections', resourceId: id })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (perm.ok === false) return perm.response
  const { id } = await params
  const supabase = createServerClient()
  // Unlink children before deleting parent
  await supabase.from('categories').update({ parent_id: null }).eq('parent_id', id)
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'delete_category', resource: 'collections', resourceId: id })
  return NextResponse.json({ success: true })
}
