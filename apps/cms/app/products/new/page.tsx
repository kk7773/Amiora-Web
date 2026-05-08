import { createServerClient } from '@amiora/database'
import { ProductCatalogCreateForm } from '@/components/forms/ProductCatalogCreateForm'

export default async function NewProductPage() {
  const supabase = createServerClient()

  const [{ data: collections }, { data: categories }, { data: metalColors }, { data: metalPurities }] =
    await Promise.all([
      supabase.from('collections').select('id, name').eq('is_active', true).order('sort_order'),
      supabase
        .from('categories')
        .select('id, name, code')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('metal_colors')
        .select('id, label, code, hex, display_order')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('metal_purities')
        .select('id, label, code, display_order')
        .eq('is_active', true)
        .order('display_order'),
    ])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-deep-teal">New product (colour × purity)</h2>
        <p className="text-sm text-ink-muted mt-0.5">Create a SKU matrix with Cloudinary images per colour.</p>
      </div>
      <ProductCatalogCreateForm
        collections={collections ?? []}
        categories={(categories ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['categories']}
        metalColors={(metalColors ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['metalColors']}
        metalPurities={(metalPurities ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['metalPurities']}
      />
    </div>
  )
}
