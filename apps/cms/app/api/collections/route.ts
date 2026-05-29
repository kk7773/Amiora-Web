import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function GET() {
  const perm = await requireCmsAccess('collections', 'view')
  if (!perm.ok) return perm.response
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('collections')
    .select('id, name, slug, description, banner_url, thumb_url, parent_id, menu_type, is_active, sort_order, created_at')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (!perm.ok) return perm.response
  const body = await req.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('collections')
    .insert({
      name:       body.name,
      slug:       body.slug,
      description:body.description ?? null,
      banner_url: body.banner_url ?? null,
      parent_id:  body.parent_id  ?? null,
      menu_type:  body.menu_type  ?? 'main',
      is_active:  body.is_active  ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'create_collection', resource: 'collections', resourceId: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
