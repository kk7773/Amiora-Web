import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('blogs', 'edit')
  if (!perm.ok) return perm.response
  const { id } = await params
  const body = await req.json()
  const supabase = createServerClient()

  const dbRow = {
    title:        body.title,
    slug:         body.slug,
    excerpt:      body.excerpt,
    body:         body.body,
    cover_url:    body.cover_url ?? body.cover_image_url ?? null,
    author:       body.author,
    tags:         body.tags,
    is_published: body.status === 'published' || body.is_published === true,
    published_at: body.published_at ?? ((body.status === 'published' || body.is_published) ? new Date().toISOString() : null),
    meta_title:       body.meta_title       ?? null,
    meta_description: body.meta_description ?? null,
  }

  const { data, error } = await supabase.from('blogs').update(dbRow).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'update_blog', resource: 'blogs', resourceId: id })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('blogs', 'edit')
  if (!perm.ok) return perm.response
  const { id } = await params
  const supabase = createServerClient()
  await supabase.from('blogs').delete().eq('id', id)
  await writeAuditLog({ adminId: perm.adminId, action: 'delete_blog', resource: 'blogs', resourceId: id })
  return NextResponse.json({ success: true })
}
