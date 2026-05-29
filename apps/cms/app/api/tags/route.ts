import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function GET() {
  const perm = await requireCmsAccess('products', 'view')
  if (perm.ok === false) return perm.response
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('tags')
    .select('id, name, slug, color, sort_order, is_active, created_at')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('products', 'edit')
  if (perm.ok === false) return perm.response
  const body = await req.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('tags')
    .insert({
      name:       body.name,
      slug:       body.slug,
      color:      body.color ?? null,
      sort_order: body.sort_order ?? 0,
      is_active:  body.is_active ?? true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'create_tag', resource: 'products', resourceId: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
