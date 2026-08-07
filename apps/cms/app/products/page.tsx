import { createServerClient } from '@amiora/database'
import { ProductsTable } from '@/components/tables/ProductsTable'
import { ProductsPageActions } from '@/components/products/ProductsPageActions'
import { isCollectionProductsTableMissing } from '@/lib/collectionProductsTable'

type ProductRow = {
  id: string
  name: string
  slug: string
  is_featured: boolean
  status: 'draft' | 'active' | 'archived' | 'make_to_order'
  design_number: string | null
  created_at: string
  collection_id: string | null
  category_id: string | null
}

type ProductListingRow = ProductRow & {
  collection?: { name: string } | null
  category?: { name: string } | null
  images?: { url: string; is_primary: boolean }[]
  color_groups?: { color_id: string; color_label: string; images: string[]; display_order: number; is_active: boolean }[]
  variants?: {
    id: string
    color_id: string | null
    color_label: string
    purity_id: string | null
    purity_label: string
    stock_qty: number
    is_active: boolean
  }[]
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
    metalColorsRes,
    metalPuritiesRes,
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
      .select('product_id, color_id, images, display_order, is_active'),
    supabase.from('product_variants').select('id, product_id, color_id, purity_id, stock_qty, is_active'),
    supabase.from('metal_colors').select('id, label'),
    supabase.from('metal_purities').select('id, label'),
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
  const statusCounts = {
    active: products.filter((product) => product.status === 'active').length,
    draft: products.filter((product) => product.status === 'draft').length,
    archived: products.filter((product) => product.status === 'archived').length,
  }

  const collectionById = new Map(collections.map((row) => [row.id, row]))
  const categoryById = new Map(categories.map((row) => [row.id, row]))
  const colorLabelById = new Map((metalColorsRes.data ?? []).map((row) => [row.id, row.label]))
  const purityLabelById = new Map((metalPuritiesRes.data ?? []).map((row) => [row.id, row.label]))

  const imagesByProduct = new Map<string, { url: string; is_primary: boolean }[]>()
  for (const row of productImagesRes.data ?? []) {
    const list = imagesByProduct.get(row.product_id) ?? []
    list.push({ url: row.url, is_primary: row.is_primary })
    imagesByProduct.set(row.product_id, list)
  }

  const colorGroupsByProduct = new Map<
    string,
    { color_id: string; color_label: string; images: string[]; display_order: number; is_active: boolean }[]
  >()
  for (const row of colorGroupsRes.data ?? []) {
    const list = colorGroupsByProduct.get(row.product_id) ?? []
    list.push({
      color_id: row.color_id,
      color_label: colorLabelById.get(row.color_id) ?? 'Unknown colour',
      images: row.images ?? [],
      display_order: row.display_order,
      is_active: row.is_active,
    })
    colorGroupsByProduct.set(row.product_id, list)
  }

  const variantsByProduct = new Map<
    string,
    {
      id: string
      color_id: string | null
      color_label: string
      purity_id: string | null
      purity_label: string
      stock_qty: number
      is_active: boolean
    }[]
  >()
  for (const row of variantsRes.data ?? []) {
    const list = variantsByProduct.get(row.product_id) ?? []
    list.push({
      id: row.id,
      color_id: row.color_id ?? null,
      color_label: row.color_id ? colorLabelById.get(row.color_id) ?? 'Unknown colour' : 'Unknown colour',
      purity_id: row.purity_id ?? null,
      purity_label: row.purity_id ? purityLabelById.get(row.purity_id) ?? 'Unknown purity' : 'Unknown purity',
      stock_qty: Number(row.stock_qty ?? 0),
      is_active: row.is_active !== false,
    })
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
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="font-display text-2xl text-deep-teal">Products</h2>
          <p className="text-sm text-ink-muted mt-0.5">{enrichedProducts.length} products total</p>
        </div>
        <div className="hidden lg:flex items-center gap-3 ml-auto">
          <div className="rounded-xl border border-divider bg-white px-4 py-3 min-w-[9rem]">
            <p className="text-[11px] uppercase tracking-widest text-ink-faint">Active Products</p>
            <p className="mt-1 text-2xl font-semibold text-deep-teal">{statusCounts.active}</p>
          </div>
          <div className="rounded-xl border border-divider bg-white px-4 py-3 min-w-[9rem]">
            <p className="text-[11px] uppercase tracking-widest text-ink-faint">Draft Products</p>
            <p className="mt-1 text-2xl font-semibold text-deep-teal">{statusCounts.draft}</p>
          </div>
          <div className="rounded-xl border border-divider bg-white px-4 py-3 min-w-[9rem]">
            <p className="text-[11px] uppercase tracking-widest text-ink-faint">Archived Products</p>
            <p className="mt-1 text-2xl font-semibold text-deep-teal">{statusCounts.archived}</p>
          </div>
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
