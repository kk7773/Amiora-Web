import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import { createCatalogProduct } from '@/lib/createCatalogProduct'
import type { CatalogProductPayload } from '@/lib/catalogProductTypes'

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('products', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const body = (await req.json()) as CatalogProductPayload
    const supabase = createServerClient()
    const result = await createCatalogProduct(supabase, body)
    if (result.ok === false) {
      const status =
        result.error.includes('matrix') || result.error.includes('colour') ? 400 : 500
      return NextResponse.json({ error: result.error }, { status })
    }
    await writeAuditLog({
      adminId: perm.adminId,
      action: 'create_product',
      resource: 'products',
      resourceId: result.productId,
    })
    return NextResponse.json({ id: result.productId }, { status: 201 })
  } catch (e: unknown) {
    console.error('[catalog]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
