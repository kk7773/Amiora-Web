import { NextResponse } from 'next/server'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import { getStorefrontUrl } from '@/lib/storefrontUrl'

export async function POST() {
  const perm = await requireCmsAccess('pricing', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const storefrontUrl = getStorefrontUrl()
    const res = await fetch(`${storefrontUrl}/api/pricing/refresh`, {
      method: 'POST',
      headers: { 'x-cms-secret': process.env.CMS_SECRET ?? '' },
    })
    if (!res.ok) throw new Error('Storefront pricing refresh failed')
    const data = await res.json()
    await writeAuditLog({ adminId: perm.adminId, action: 'refresh_pricing', resource: 'pricing' })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
