import { createServerClient } from '@amiora/database'
import { ProductsTable } from '@/components/tables/ProductsTable'
import { ProductsPageActions } from '@/components/products/ProductsPageActions'
import { isCollectionProductsTableMissing } from '@/lib/collectionProductsTable'

const PRODUCT_SELECT_BASE = `
  id, name, slug, is_featured, status, product_number, design_number, created_at,
  collection:collections(name),
  category:categories(name, code),
  images:product_images(url, is_primary),
  color_groups:product_color_groups(images, display_order, is_active),
  variants:product_variants(id)
`

export default async function ProductsPage() {
  const supabase = createServerClient()

  const productsQuery = await supabase
    .from('products')
    .select(PRODUCT_SELECT_BASE)
    .order('created_at', { ascending: false })

  let products = productsQuery.data ?? []

  const linksProbe = await supabase.from('collection_products').select('product_id').limit(1)
  if (!linksProbe.error && !isCollectionProductsTableMissing(linksProbe.error)) {
    const { data: linkRows } = await supabase
      .from('collection_products')
      .select('product_id, collections(name)')

    if (linkRows?.length) {
      const byProduct: Record<string, { collections: { name: string } | null }[]> = {}
      for (const row of linkRows) {
        const pid = row.product_id as string
        const coll = row.collections as { name: string } | { name: string }[] | null
        const collObj = Array.isArray(coll) ? coll[0] ?? null : coll
        if (!byProduct[pid]) byProduct[pid] = []
        byProduct[pid].push({ collections: collObj })
      }
      products = products.map((p) => ({
        ...p,
        collection_links: byProduct[p.id] ?? [],
      }))
    }
  }

  const [{ data: collections }, { data: categories }] = await Promise.all([
    supabase.from('collections').select('id, name').eq('is_active', true),
    supabase.from('categories').select('id, name'),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-deep-teal">Products</h2>
          <p className="text-sm text-ink-muted mt-0.5">{products.length} products total</p>
        </div>
        <ProductsPageActions />
      </div>
      <ProductsTable
        products={products as unknown as Parameters<typeof ProductsTable>[0]['products']}
        collections={(collections ?? []) as Parameters<typeof ProductsTable>[0]['collections']}
        categories={(categories ?? []) as Parameters<typeof ProductsTable>[0]['categories']}
      />
    </div>
  )
}
