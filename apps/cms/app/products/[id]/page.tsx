import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@amiora/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ProductCatalogCreateForm } from '@/components/forms/ProductCatalogCreateForm'

interface Props {
  params: Promise<{ id: string }>
}

type ColorGroupRow = {
  id: string
  color_id: string
  images: string[] | null
  videos: string[]
  display_order: number
}

async function fetchProductColorGroups(
  supabase: SupabaseClient,
  productId: string,
): Promise<ColorGroupRow[]> {
  const withVideos = await supabase
    .from('product_color_groups')
    .select('id, color_id, images, videos, display_order')
    .eq('product_id', productId)
    .order('display_order', { ascending: true })

  if (!withVideos.error) {
    return (withVideos.data ?? []).map((row) => ({
      id: row.id,
      color_id: row.color_id,
      images: row.images,
      videos: row.videos ?? [],
      display_order: row.display_order,
    }))
  }

  const withoutVideos = await supabase
    .from('product_color_groups')
    .select('id, color_id, images, display_order')
    .eq('product_id', productId)
    .order('display_order', { ascending: true })

  if (withoutVideos.error) {
    console.error('[EditProductPage] product_color_groups:', withoutVideos.error.message)
    return []
  }

  return (withoutVideos.data ?? []).map((row) => ({
    id: row.id,
    color_id: row.color_id,
    images: row.images,
    videos: [],
    display_order: row.display_order,
  }))
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params
  const supabase = createServerClient()

  const [{ data: product, error: productError }, { data: collections }, { data: categories }, { data: tags }, { data: metalColors }, { data: metalPurities }] =
    await Promise.all([
      supabase
        .from('products')
        .select(`
          id, name, slug, category_id, collection_id, product_number, design_number, short_desc, description,
          diamond_shape, diamond_count, total_diamond_wt, diamond_color, diamond_clarity, size_range, metal_weight_g,
          meta_title, meta_description, status, is_featured, is_new_arrival, is_best_seller, is_coming_soon, making_charge_pct,
          has_stone, stone_lines,
          product_variants(
            id, color_id, purity_id, sku, price, stock_qty, metal_weight_g, is_active
          )
        `)
        .eq('id', id)
        .single(),
      supabase.from('collections').select('id, name').eq('is_active', true).order('sort_order'),
      supabase.from('categories').select('id, name, code').eq('is_active', true).order('sort_order'),
      supabase.from('tags').select('id, name, color').eq('is_active', true).order('sort_order'),
      supabase
        .from('metal_colors')
        .select('id, label, code, hex, display_order')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('metal_purities')
        .select('id, label, code, display_order, metal')
        .eq('is_active', true)
        .order('display_order'),
    ])

  if (productError) {
    console.error('[EditProductPage] products:', productError.message, '| id:', id)
  }
  if (!product) notFound()

  let collection_ids: string[] = []
  const { data: collectionLinks, error: collLinksErr } = await supabase
    .from('collection_products')
    .select('collection_id')
    .eq('product_id', product.id)

  if (!collLinksErr && collectionLinks?.length) {
    collection_ids = collectionLinks.map((r) => r.collection_id)
  } else if (product.collection_id) {
    collection_ids = [product.collection_id]
  }

  const { data: tagLinks } = await supabase
    .from('product_tags')
    .select('tag_id')
    .eq('product_id', product.id)

  const tag_ids = (tagLinks ?? []).map((r) => r.tag_id)

  const colorGroupRows = await fetchProductColorGroups(supabase, product.id)

  const colorVariants = (colorGroupRows as Array<{
    id: string
    color_id: string
    images: string[] | null
    videos?: string[] | null
    display_order: number
  }>)
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((row) => ({
      id: row.id,
      color_id: row.color_id,
      images: row.images ?? [],
      videos: row.videos ?? [],
      display_order: row.display_order,
    }))

  const matrix = ((product.product_variants ?? []) as Array<{
    id: string
    color_id: string
    purity_id: string
    sku: string
    price: number | string
    stock_qty: number
    metal_weight_g: number | null
    is_active: boolean
  }>).map((row) => ({
    id: row.id,
    color_id: row.color_id,
    purity_id: row.purity_id,
    sku: row.sku,
    price: Number(row.price),
    stock_qty: row.stock_qty,
    metal_weight_g:
      row.metal_weight_g != null && Number.isFinite(Number(row.metal_weight_g))
        ? Number(row.metal_weight_g)
        : null,
    is_active: row.is_active,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-deep-teal">Edit product</h2>
          <p className="text-sm text-ink-muted mt-0.5">{product.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/products" className="text-sm text-teal underline underline-offset-4">
            Back to products
          </Link>
          <Link href="/products/new" className="text-sm text-teal underline underline-offset-4">
            Create another
          </Link>
        </div>
      </div>

      <ProductCatalogCreateForm
        collections={collections ?? []}
        tags={tags ?? []}
        categories={(categories ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['categories']}
        metalColors={(metalColors ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['metalColors']}
        metalPurities={(metalPurities ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['metalPurities']}
        initialData={{
          id: product.id,
          product: {
            name: product.name,
            slug: product.slug,
            category_id: product.category_id ?? '',
            collection_id: product.collection_id,
            collection_ids: collection_ids.length > 0 ? collection_ids : undefined,
            tag_ids: tag_ids.length > 0 ? tag_ids : undefined,
            product_number: product.product_number,
            design_number: product.design_number ?? null,
            short_desc: product.short_desc,
            description: product.description,
            diamond_shape: product.diamond_shape,
            diamond_count: product.diamond_count,
            total_diamond_wt: product.total_diamond_wt,
            diamond_color: product.diamond_color,
            diamond_clarity: product.diamond_clarity,
            size_range: product.size_range,
            metal_weight_g:
              product.metal_weight_g != null && Number.isFinite(Number(product.metal_weight_g))
                ? Number(product.metal_weight_g)
                : null,
            meta_title: product.meta_title,
            meta_description: product.meta_description,
            status: product.status,
            is_featured: product.is_featured,
            is_new_arrival: product.is_new_arrival,
            is_best_seller: product.is_best_seller,
            is_coming_soon: product.is_coming_soon,
            making_charge_pct: Number(product.making_charge_pct ?? 8),
            has_stone: Boolean(product.has_stone),
            stone_lines: product.stone_lines ?? [],
          },
          colorVariants,
          matrix,
        }}
      />
    </div>
  )
}
