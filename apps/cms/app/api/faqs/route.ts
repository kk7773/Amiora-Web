import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function GET() {
  const perm = await requireCmsAccess('faqs', 'view')
  if (perm.ok === false) return perm.response
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('site_faqs')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('faqs', 'edit')
  if (perm.ok === false) return perm.response
  const supabase = createServerClient()
  const body = await req.json()
  const { question, answer, sort_order = 0, is_active = true } = body
  if (!question?.trim() || !answer?.trim())
    return NextResponse.json({ error: 'question and answer are required' }, { status: 400 })
  const { data, error } = await supabase
    .from('site_faqs')
    .insert({ question: question.trim(), answer: answer.trim(), sort_order, is_active })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAuditLog({ adminId: perm.adminId, action: 'create_faq', resource: 'faqs', resourceId: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
