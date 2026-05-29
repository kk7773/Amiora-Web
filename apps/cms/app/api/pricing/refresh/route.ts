import { NextResponse } from 'next/server'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function POST() {
  const perm = await requireCmsAccess('pricing', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3000'
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
