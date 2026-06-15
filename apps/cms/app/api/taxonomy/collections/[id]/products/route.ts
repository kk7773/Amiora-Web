import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import {
  addProductsToCollection,
  removeProductFromCollection,
  swapCollectionProductOrder,
} from '@/lib/syncCollectionProducts'
import { isCollectionProductsTableMissing } from '@/lib/collectionProductsTable'
import {
  fetchCollectionProductsPaginated,
  parseTaxonomyListParams,
} from '@/lib/taxonomyProductList'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'view')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)

  try {
    const result = await fetchCollectionProductsPaginated(id, listParams)
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
  const tableProbe = await supabase.from('collection_products').select('collection_id').limit(1)
  if (isCollectionProductsTableMissing(tableProbe.error)) {
    return NextResponse.json(
      {
        error:
          'collection_products table missing — run migration 020_collection_products.sql in Supabase SQL Editor',
      },
      { status: 503 },
    )
  }

  const result = await addProductsToCollection(supabase, id, productIds)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  await writeAuditLog({
    adminId: perm.adminId,
    action: 'add_collection_products',
    resource: 'collections',
    resourceId: id,
    meta: { productIds, added: result.added },
  })

  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)
  const pageResult = await fetchCollectionProductsPaginated(id, listParams, supabase)
  return NextResponse.json({ ...pageResult, added: result.added })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const result = await removeProductFromCollection(supabase, id, productId)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  await writeAuditLog({
    adminId: perm.adminId,
    action: 'remove_collection_product',
    resource: 'collections',
    resourceId: id,
    meta: { productId },
  })

  const listParams = parseTaxonomyListParams(req.nextUrl.searchParams)
  const pageResult = await fetchCollectionProductsPaginated(id, listParams, supabase)
  return NextResponse.json(pageResult)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('collections', 'edit')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const body = (await req.json()) as { productId?: string; direction?: 'up' | 'down' }

  if (!body.productId || (body.direction !== 'up' && body.direction !== 'down')) {
    return NextResponse.json({ error: 'productId and direction (up|down) required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const result = await swapCollectionProductOrder(supabase, id, body.productId, body.direction)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  await writeAuditLog({
    adminId: perm.adminId,
    action: 'reorder_collection_products',
    resource: 'collections',
    resourceId: id,
    meta: { productId: body.productId, direction: body.direction },
  })

  return NextResponse.json({ success: true })
}
