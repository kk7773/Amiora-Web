import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function GET() {
  const perm = await requireCmsAccess('coupons', 'view')
  if (perm.ok === false) return perm.response
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('coupons', 'edit')
  if (perm.ok === false) return perm.response
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code:                 body.code.toUpperCase().trim(),
      description:          body.description         ?? null,
      type:                 body.type,
      value:                Number(body.value),
      applies_to:           body.applies_to          ?? 'both',
      min_order_amount:     Number(body.min_order_amount ?? 0),
      max_discount_amount:  body.max_discount_amount ? Number(body.max_discount_amount) : null,
      usage_limit:          body.usage_limit         ? Number(body.usage_limit) : null,
      expires_at:           body.expires_at          ?? null,
      is_active:            body.is_active           ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'create_coupon', resource: 'coupons', resourceId: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
