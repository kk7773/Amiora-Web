import { NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess } from '@/lib/rbac'
import { isCollectionProductsTableMissing } from '@/lib/collectionProductsTable'

/** Batch product counts for taxonomy rows (badges on Collections page). */
export async function GET() {
  const perm = await requireCmsAccess('collections', 'view')
  if (perm.ok === false) return perm.response

  const supabase = createServerClient()

  const [colLinks, catProducts, tagLinks] = await Promise.all([
    supabase.from('collection_products').select('collection_id'),
    supabase.from('products').select('category_id').not('category_id', 'is', null),
    supabase.from('product_tags').select('tag_id'),
  ])

  const collections: Record<string, number> = {}

  if (!colLinks.error && colLinks.data) {
    for (const row of colLinks.data) {
      collections[row.collection_id] = (collections[row.collection_id] ?? 0) + 1
    }
  } else if (isCollectionProductsTableMissing(colLinks.error)) {
    const { data: legacy } = await supabase
      .from('products')
      .select('collection_id')
      .not('collection_id', 'is', null)
    for (const row of legacy ?? []) {
      if (row.collection_id) {
        collections[row.collection_id] = (collections[row.collection_id] ?? 0) + 1
      }
    }
  }

  const categories: Record<string, number> = {}
  for (const row of catProducts.data ?? []) {
    if (row.category_id) {
      categories[row.category_id] = (categories[row.category_id] ?? 0) + 1
    }
  }

  const tags: Record<string, number> = {}
  for (const row of tagLinks.data ?? []) {
    tags[row.tag_id] = (tags[row.tag_id] ?? 0) + 1
  }

  return NextResponse.json({ collections, categories, tags })
}
