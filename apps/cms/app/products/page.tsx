import { createServerClient } from '@amiora/database'
import { ProductsTable } from '@/components/tables/ProductsTable'
import { ProductsPageActions } from '@/components/products/ProductsPageActions'
import { isCollectionProductsTableMissing } from '@/lib/collectionProductsTable'

type ProductRow = {
  id: string
  name: string
  slug: string
  is_featured: boolean
  status: 'draft' | 'active' | 'archived'
  design_number: string | null
  created_at: string
  collection_id: string | null
  category_id: string | null
}

type ProductListingRow = ProductRow & {
  collection?: { name: string } | null
  category?: { name: string } | null
  images?: { url: string; is_primary: boolean }[]
  color_groups?: { images: string[]; display_order: number; is_active: boolean }[]
  variants?: { id: string }[]
  collection_links?: { collections: { name: string } | null }[]
}

export default async function ProductsPage() {
  const supabase = createServerClient()

  const [
    productsRes,
    collectionsRes,
    categoriesRes,
    productImagesRes,
    colorGroupsRes,
    variantsRes,
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, slug, is_featured, status, design_number, created_at, collection_id, category_id')
      .order('created_at', { ascending: false }),
    supabase.from('collections').select('id, name').eq('is_active', true),
    supabase.from('categories').select('id, name'),
    supabase.from('product_images').select('product_id, url, is_primary'),
    supabase
      .from('product_color_groups')
      .select('product_id, images, display_order, is_active'),
    supabase.from('product_variants').select('id, product_id'),
  ])

  if (productsRes.error) {
    console.error('[CMS ProductsPage] products:', productsRes.error.message)
  }
  if (productImagesRes.error) {
    console.error('[CMS ProductsPage] product_images:', productImagesRes.error.message)
  }
  if (colorGroupsRes.error) {
    console.error('[CMS ProductsPage] product_color_groups:', colorGroupsRes.error.message)
  }
  if (variantsRes.error) {
    console.error('[CMS ProductsPage] product_variants:', variantsRes.error.message)
  }

  const products = (productsRes.data ?? []) as ProductRow[]
  const collections = collectionsRes.data ?? []
  const categories = categoriesRes.data ?? []

  const collectionById = new Map(collections.map((row) => [row.id, row]))
  const categoryById = new Map(categories.map((row) => [row.id, row]))

  const imagesByProduct = new Map<string, { url: string; is_primary: boolean }[]>()
  for (const row of productImagesRes.data ?? []) {
    const list = imagesByProduct.get(row.product_id) ?? []
    list.push({ url: row.url, is_primary: row.is_primary })
    imagesByProduct.set(row.product_id, list)
  }

  const colorGroupsByProduct = new Map<
    string,
    { images: string[]; display_order: number; is_active: boolean }[]
  >()
  for (const row of colorGroupsRes.data ?? []) {
    const list = colorGroupsByProduct.get(row.product_id) ?? []
    list.push({
      images: row.images ?? [],
      display_order: row.display_order,
      is_active: row.is_active,
    })
    colorGroupsByProduct.set(row.product_id, list)
  }

  const variantsByProduct = new Map<string, { id: string }[]>()
  for (const row of variantsRes.data ?? []) {
    const list = variantsByProduct.get(row.product_id) ?? []
    list.push({ id: row.id })
    variantsByProduct.set(row.product_id, list)
  }

  let enrichedProducts: ProductListingRow[] = products.map((product) => ({
    ...product,
    collection: product.collection_id ? collectionById.get(product.collection_id) ?? null : null,
    category: product.category_id ? categoryById.get(product.category_id) ?? null : null,
    images: imagesByProduct.get(product.id) ?? [],
    color_groups: colorGroupsByProduct.get(product.id) ?? [],
    variants: variantsByProduct.get(product.id) ?? [],
  }))

  const linksProbe = await supabase.from('collection_products').select('product_id').limit(1)
  if (linksProbe.error && !isCollectionProductsTableMissing(linksProbe.error)) {
    console.error('[CMS ProductsPage] collection_products probe:', linksProbe.error.message)
  }

  if (!linksProbe.error) {
    const { data: linkRows, error: linkRowsError } = await supabase
      .from('collection_products')
      .select('product_id, collections(name)')

    if (linkRowsError) {
      console.error('[CMS ProductsPage] collection_products:', linkRowsError.message)
    } else if (linkRows?.length) {
      const byProduct: Record<string, { collections: { name: string } | null }[]> = {}
      for (const row of linkRows) {
        const pid = row.product_id as string
        const coll = row.collections as { name: string } | { name: string }[] | null
        const collObj = Array.isArray(coll) ? (coll[0] ?? null) : coll
        if (!byProduct[pid]) byProduct[pid] = []
        byProduct[pid].push({ collections: collObj })
      }

      enrichedProducts = enrichedProducts.map((product) => ({
        ...product,
        collection_links: byProduct[product.id] ?? [],
      }))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-deep-teal">Products</h2>
          <p className="text-sm text-ink-muted mt-0.5">{enrichedProducts.length} products total</p>
        </div>
        <ProductsPageActions />
      </div>
      <ProductsTable
        products={enrichedProducts as Parameters<typeof ProductsTable>[0]['products']}
        collections={collections as Parameters<typeof ProductsTable>[0]['collections']}
        categories={categories as Parameters<typeof ProductsTable>[0]['categories']}
      />
    </div>
  )
}
