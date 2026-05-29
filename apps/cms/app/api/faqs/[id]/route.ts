import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('faqs', 'edit')
  if (perm.ok === false) return perm.response
  const { id } = await params
  const supabase = createServerClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('site_faqs')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'update_faq', resource: 'faqs', resourceId: id })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('faqs', 'edit')
  if (perm.ok === false) return perm.response
  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from('site_faqs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'delete_faq', resource: 'faqs', resourceId: id })
  return NextResponse.json({ success: true })
}
