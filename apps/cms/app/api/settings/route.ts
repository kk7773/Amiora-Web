import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function PATCH(req: NextRequest) {
  const perm = await requireCmsAccess('settings', 'edit')
  if (perm.ok === false) return perm.response
  const body = await req.json()
  const supabase = createServerClient()

  if (body.making_charge_pct !== undefined) {
    await supabase
      .from('site_settings')
      .upsert({ key: 'making_charge_pct', value: String(body.making_charge_pct) }, { onConflict: 'key' })
  }

  if (body.announcement !== undefined) {
    await supabase
      .from('site_settings')
      .upsert({ key: 'announcement_bar', value: body.announcement }, { onConflict: 'key' })
  }

  await writeAuditLog({ adminId: perm.adminId, action: 'update_settings', resource: 'settings' })
  return NextResponse.json({ success: true })
}
