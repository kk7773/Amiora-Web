import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perm = await requireCmsAccess('coupons', 'edit')
  if (perm.ok === false) return perm.response
  const { id } = await params
  const body    = await req.json()
  const supabase = createServerClient()

  const patch: Record<string, unknown> = {}
  if (body.code                !== undefined) patch.code                = body.code.toUpperCase().trim()
  if (body.description         !== undefined) patch.description         = body.description
  if (body.type                !== undefined) patch.type                = body.type
  if (body.value               !== undefined) patch.value               = Number(body.value)
  if (body.applies_to          !== undefined) patch.applies_to          = body.applies_to
  if (body.min_order_amount    !== undefined) patch.min_order_amount    = Number(body.min_order_amount)
  if (body.max_discount_amount !== undefined) patch.max_discount_amount = body.max_discount_amount ? Number(body.max_discount_amount) : null
  if (body.usage_limit         !== undefined) patch.usage_limit         = body.usage_limit ? Number(body.usage_limit) : null
  if (body.expires_at          !== undefined) patch.expires_at          = body.expires_at || null
  if (body.is_active           !== undefined) patch.is_active           = body.is_active

  const { data, error } = await supabase
    .from('coupons')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'update_coupon', resource: 'coupons', resourceId: id })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perm = await requireCmsAccess('coupons', 'edit')
  if (perm.ok === false) return perm.response
  const { id } = await params
  const supabase = createServerClient()

  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'delete_coupon', resource: 'coupons', resourceId: id })
  return NextResponse.json({ success: true })
}
