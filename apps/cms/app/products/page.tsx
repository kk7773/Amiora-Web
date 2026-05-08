import Link from 'next/link'
import { createServerClient } from '@amiora/database'
import { ProductsTable } from '@/components/tables/ProductsTable'
import { Plus } from 'lucide-react'

export default async function ProductsPage() {
  const supabase = createServerClient()

  // All 3 queries are independent — run in parallel
  const [{ data: products }, { data: collections }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name, slug, is_featured, status, product_number, created_at,
        collection:collections(name),
        category:categories(name, code),
        images:product_images(url, is_primary),
        variants:product_variants(id)
      `)
      .order('created_at', { ascending: false }),
    supabase.from('collections').select('id, name').eq('is_active', true),
    supabase.from('categories').select('id, name'),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-deep-teal">Products</h2>
          <p className="text-sm text-ink-muted mt-0.5">{products?.length ?? 0} products total</p>
        </div>
        <Link href="/products/new" className="inline-flex items-center gap-2 bg-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-deep-teal transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>
      <ProductsTable
        products={(products ?? []) as unknown as Parameters<typeof ProductsTable>[0]['products']}
        collections={(collections ?? []) as Parameters<typeof ProductsTable>[0]['collections']}
        categories={(categories ?? []) as Parameters<typeof ProductsTable>[0]['categories']}
      />
    </div>
  )
}
