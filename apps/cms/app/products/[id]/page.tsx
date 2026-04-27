import { createServerClient } from '@amiora/database'
import { ProductForm } from '@/components/forms/ProductForm'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function EditProductPage({ params }: Props) {
  const { id } = await params
  const supabase = createServerClient()

  const [{ data: product }, { data: collections }, { data: categories }, { data: tags }, { data: productTags }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        *,
        collection:collections(id, name),
        category:categories(id, name),
        product_images(id, url, is_primary, sort_order),
        product_variants(
          id, purity, weight_grams, gem_weight_ct,
          gem_price_override, stock_status,
          metal_variant_id, gem_variant_id,
          metal_variant:metal_variants(variant_name),
          gem_variant:gem_variants(cut_name)
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('collections')
      .select('id, name, parent_id, menu_type')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('categories')
      .select('id, name, parent_id')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('tags')
      .select('id, name, slug, color')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('product_tags')
      .select('tag_id')
      .eq('product_id', id),
  ])

  if (!product) notFound()

  // ── Images: sort by sort_order ────────────────────────────────────────────
  const sortedImages = ((product.product_images ?? []) as {
    url: string; is_primary: boolean; sort_order: number
  }[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ url, is_primary }) => ({ url, is_primary }))

  // ── Variants: map DB columns → form fields ────────────────────────────────
  type DBVariant = {
    id: string
    purity:             string
    weight_grams:       number | null
    gem_weight_ct:      number | null
    gem_price_override: number | null
    stock_status:       string
    making_charge_discount_pct: number | null
    gem_price_discount_pct:     number | null
    metal_variant:      { variant_name: string } | null
    gem_variant:        { cut_name: string }     | null
  }

  const mappedVariants = ((product.product_variants ?? []) as unknown as DBVariant[]).map(v => {
    // Derive metal_type from variant_name (e.g. "Yellow Gold" → "gold", "Sterling Silver" → "silver")
    const variantName = (v.metal_variant?.variant_name ?? '').toLowerCase()
    const metal_type  = variantName.includes('silver') ? 'silver'
                      : variantName.includes('platinum') ? 'platinum'
                      : 'gold'

    // Derive gold colour variant from name (yellow / rose / white)
    const gold_variant = variantName.includes('rose')  ? 'rose'
                       : variantName.includes('white') ? 'white'
                       : variantName.includes('yellow') ? 'yellow'
                       : ''

    return {
      id: v.id,
      metal_type,
      purity:       v.purity        ?? '',
      gold_variant,
      gem_cut:      v.gem_variant?.cut_name ?? '',
      weight_grams: v.weight_grams       ?? 0,
      gem_weight_ct:v.gem_weight_ct      ?? undefined,
      gem_price_inr:v.gem_price_override ?? undefined,
      stock_status: v.stock_status       ?? 'in_stock',
      making_charge_discount_pct:
        v.making_charge_discount_pct != null && v.making_charge_discount_pct !== undefined
          ? Number(v.making_charge_discount_pct)
          : null,
      gem_price_discount_pct:
        v.gem_price_discount_pct != null && v.gem_price_discount_pct !== undefined
          ? Number(v.gem_price_discount_pct)
          : null,
    }
  })

  const existingTagIds = (productTags ?? []).map((pt: { tag_id: string }) => pt.tag_id)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-deep-teal">Edit Product</h2>
        <p className="text-sm text-ink-muted mt-0.5">{product.name}</p>
      </div>
      <ProductForm
        collections={collections ?? []}
        categories={categories   ?? []}
        tags={tags               ?? []}
        defaultValues={{
          id,
          name:              product.name,
          slug:              product.slug,
          sku:               product.sku               ?? '',
          short_description: product.short_description ?? '',
          full_description:  product.description       ?? '',
          collection_id:     (product.collection as { id: string } | null)?.id ?? '',
          category_id:       (product.category   as { id: string } | null)?.id ?? '',
          tag_ids:           existingTagIds,
          is_featured:       product.is_featured       ?? false,
          is_active:         product.is_active         ?? true,
          making_charge_pct: product.making_charge_pct ?? 8,
          making_charge_discount_pct:
            (product as { making_charge_discount_pct?: number | null }).making_charge_discount_pct ?? 0,
          gem_price_discount_pct:
            (product as { gem_price_discount_pct?: number | null }).gem_price_discount_pct ?? 0,
          meta_title:        product.meta_title        ?? '',
          meta_description:  product.meta_description  ?? '',
          product_images:    sortedImages,
          variants:          mappedVariants,
        }}
      />
    </div>
  )
}
