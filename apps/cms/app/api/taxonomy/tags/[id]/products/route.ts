import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import {
  fetchTagProductsPaginated,
  parseTaxonomyListParams,
} from '@/lib/taxonomyProductList'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('products', 'view')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)

  try {
    const result = await fetchTagProductsPaginated(id, listParams)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load products' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('products', 'edit')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const body = (await req.json()) as { productIds?: string[] }
  const productIds = Array.isArray(body.productIds) ? body.productIds : []

  if (productIds.length === 0) {
    return NextResponse.json({ error: 'productIds required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('product_tags')
    .select('product_id')
    .eq('tag_id', id)
    .in('product_id', productIds)

  const existingSet = new Set((existing ?? []).map((r) => r.product_id))
  const toAdd = productIds.filter((pid) => !existingSet.has(pid))

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('product_tags')
      .insert(toAdd.map((product_id) => ({ product_id, tag_id: id })))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  await writeAuditLog({
    adminId: perm.adminId,
    action: 'add_tag_products',
    resource: 'products',
    resourceId: id,
    meta: { productIds: toAdd },
  })

  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)
  const pageResult = await fetchTagProductsPaginated(id, listParams, supabase)
  return NextResponse.json({ ...pageResult, added: toAdd.length })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('products', 'edit')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('product_tags')
    .delete()
    .eq('tag_id', id)
    .eq('product_id', productId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    adminId: perm.adminId,
    action: 'remove_tag_product',
    resource: 'products',
    resourceId: id,
    meta: { productId },
  })

  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)
  const pageResult = await fetchTagProductsPaginated(id, listParams, supabase)
  return NextResponse.json(pageResult)
}
