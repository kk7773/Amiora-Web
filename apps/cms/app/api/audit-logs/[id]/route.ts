import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'
import { enrichAuditLog } from '@/lib/auditLogEnrichment'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isCmsSuperAdminApi())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const ac = adminClient()

  const { data: log, error } = await ac
    .from('admin_audit_logs')
    .select(`
      id,
      action,
      resource,
      resource_id,
      meta,
      created_at,
      admin_id,
      profiles:admin_id ( full_name )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 })

  const enrichment = await enrichAuditLog(log)

  return NextResponse.json({ log, ...enrichment })
}
