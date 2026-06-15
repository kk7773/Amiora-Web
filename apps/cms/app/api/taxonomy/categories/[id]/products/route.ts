import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import {
  fetchCategoryProductsPaginated,
  parseTaxonomyListParams,
} from '@/lib/taxonomyProductList'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'view')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)

  try {
    const result = await fetchCategoryProductsPaginated(id, listParams)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load products' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const body = (await req.json()) as { productIds?: string[] }
  const productIds = Array.isArray(body.productIds) ? body.productIds : []

  if (productIds.length === 0) {
    return NextResponse.json({ error: 'productIds required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('products')
    .update({ category_id: id })
    .in('id', productIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    adminId: perm.adminId,
    action: 'add_category_products',
    resource: 'collections',
    resourceId: id,
    meta: { productIds },
  })

  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)
  const pageResult = await fetchCategoryProductsPaginated(id, listParams, supabase)
  return NextResponse.json(pageResult)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as { newCategoryId?: string }
  const newCategoryId = body.newCategoryId ?? req.nextUrl.searchParams.get('newCategoryId')

  if (!newCategoryId) {
    return NextResponse.json(
      { error: 'newCategoryId required — category cannot be empty on a product' },
      { status: 400 },
    )
  }

  if (newCategoryId === id) {
    return NextResponse.json({ error: 'Choose a different category' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: product } = await supabase
    .from('products')
    .select('category_id')
    .eq('id', productId)
    .maybeSingle()

  if (product?.category_id !== id) {
    return NextResponse.json({ error: 'Product is not in this category' }, { status: 400 })
  }

  const { error } = await supabase
    .from('products')
    .update({ category_id: newCategoryId })
    .eq('id', productId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog({
    adminId: perm.adminId,
    action: 'remove_category_product',
    resource: 'collections',
    resourceId: id,
    meta: { productId, newCategoryId },
  })

  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)
  const pageResult = await fetchCategoryProductsPaginated(id, listParams, supabase)
  return NextResponse.json(pageResult)
}
