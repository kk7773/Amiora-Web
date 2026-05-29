import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('blogs', 'edit')
  if (perm.ok === false) return perm.response
  const body = await req.json()
  const supabase = createServerClient()

  // Map form fields to DB columns
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

  const { data, error } = await supabase.from('blogs').insert(dbRow).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'create_blog', resource: 'blogs', resourceId: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
