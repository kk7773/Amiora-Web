import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import { isSiteSettingsTableMissing } from '@/lib/siteSettingsTable'

export async function PATCH(req: NextRequest) {
  const perm = await requireCmsAccess('settings', 'edit')
  if (perm.ok === false) return perm.response
  const body = await req.json()
  const supabase = createServerClient()
  const tableProbe = await supabase.from('site_settings').select('key').limit(1)

  if (isSiteSettingsTableMissing(tableProbe.error)) {
    return NextResponse.json(
      {
        error: 'site_settings table missing — run migration 032_site_settings.sql in Supabase SQL Editor',
      },
      { status: 503 },
    )
  }

  if (body.making_charge_pct !== undefined) {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'making_charge_pct', value: String(body.making_charge_pct) }, { onConflict: 'key' })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (body.announcement !== undefined) {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'announcement_bar', value: body.announcement }, { onConflict: 'key' })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  await writeAuditLog({ adminId: perm.adminId, action: 'update_settings', resource: 'settings' })
  revalidatePath('/settings')
  revalidatePath('/products/new')
  return NextResponse.json({ success: true })
}
