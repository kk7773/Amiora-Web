import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@amiora/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ProductCatalogCreateForm } from '@/components/forms/ProductCatalogCreateForm'
import { ensureGoldMetalPurities } from '@/lib/ensureMetalPurities'
import { fetchCmsPricingContext } from '@/lib/fetchCmsPricingContext'

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

type VariantSizeRow = {
  id: string
  variant_id: string
  color_id: string
  purity_id: string
  size_label: string
  size_type: 'ring_us' | 'chain_inch'
  stock_qty: number
  metal_weight_g: number | null
  price_override: number | null
  is_active: boolean
}

function isMissingChainLengthsColumn(error: { message: string; code?: string } | null | undefined) {
  return !!error && /chain_lengths/i.test(error.message) && /(column|schema cache|does not exist|42703)/i.test(error.message)
}

function isMissingProductVariantSizesTable(error: { message: string; code?: string } | null | undefined) {
  return !!error && /product_variant_sizes/i.test(error.message) && /(schema cache|does not exist|42703|relation)/i.test(error.message)
}

function isMissingProductVariantSizesMetalWeight(error: { message: string; code?: string } | null | undefined) {
  return !!error && /metal_weight_g/i.test(error.message) && /product_variant_sizes/i.test(error.message) && /(schema cache|does not exist|42703|column)/i.test(error.message)
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

async function fetchProductSizeStocks(
  supabase: SupabaseClient,
  productId: string,
): Promise<VariantSizeRow[]> {
  const withMetalWeight = await supabase
    .from('product_variant_sizes')
    .select('id, variant_id, size_label, size_type, stock_qty, metal_weight_g, price_override, is_active')
    .eq('product_id', productId)
    .order('size_label', { ascending: true })

  const withoutMetalWeight =
    isMissingProductVariantSizesMetalWeight(withMetalWeight.error)
      ? await supabase
          .from('product_variant_sizes')
          .select('id, variant_id, size_label, size_type, stock_qty, price_override, is_active')
          .eq('product_id', productId)
          .order('size_label', { ascending: true })
      : null

  const data = withoutMetalWeight?.data ?? withMetalWeight.data
  const error = withoutMetalWeight?.error ?? withMetalWeight.error

  if (error) {
    if (isMissingProductVariantSizesTable(error)) return []
    console.error('[EditProductPage] product_variant_sizes:', error.message)
    return []
  }

  const variantIds = [...new Set((data ?? []).map((row) => row.variant_id).filter(Boolean))]
  if (variantIds.length === 0) return []

  const { data: variants, error: variantError } = await supabase
    .from('product_variants')
    .select('id, color_id, purity_id')
    .in('id', variantIds)

  if (variantError) {
    console.error('[EditProductPage] product_variants for size stocks:', variantError.message)
    return []
  }

  const variantMap = new Map((variants ?? []).map((row) => [row.id, row]))
  return (data ?? []).flatMap((row) => {
    const variant = variantMap.get(row.variant_id)
    if (!variant?.id || !variant.color_id || !variant.purity_id) return []
    return [{
      id: row.id,
      variant_id: row.variant_id,
      color_id: variant.color_id,
      purity_id: variant.purity_id,
      size_label: row.size_label,
      size_type: row.size_type === 'chain_inch' ? 'chain_inch' : 'ring_us',
      stock_qty: Number(row.stock_qty ?? 0),
      metal_weight_g: 'metal_weight_g' in row && row.metal_weight_g != null ? Number(row.metal_weight_g) : null,
      price_override: row.price_override != null ? Number(row.price_override) : null,
      is_active: row.is_active !== false,
    }]
  })
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params
  const supabase = createServerClient()
  await ensureGoldMetalPurities(supabase)
  const pricingContext = await fetchCmsPricingContext(supabase)

  const productSelectWithChain = `
          id, name, slug, category_id, collection_id, product_number, design_number, short_desc, description,
          diamond_shape, diamond_count, total_diamond_wt, diamond_color, diamond_clarity, size_range, chain_lengths, metal_weight_g,
          meta_title, meta_description, status, is_featured, is_new_arrival, is_best_seller, is_coming_soon, making_charge_pct,
          has_stone, stone_lines,
          product_variants(
            id, color_id, purity_id, sku, price, stock_qty, metal_weight_g, is_active
          )
        `
  const productSelectWithoutChain = `
          id, name, slug, category_id, collection_id, product_number, design_number, short_desc, description,
          diamond_shape, diamond_count, total_diamond_wt, diamond_color, diamond_clarity, size_range, metal_weight_g,
          meta_title, meta_description, status, is_featured, is_new_arrival, is_best_seller, is_coming_soon, making_charge_pct,
          has_stone, stone_lines,
          product_variants(
            id, color_id, purity_id, sku, price, stock_qty, metal_weight_g, is_active
          )
        `

  const productRes = await supabase.from('products').select(productSelectWithChain).eq('id', id).single()
  const product = productRes.data ?? null
  const productError = productRes.error
  const fallbackProductRes = isMissingChainLengthsColumn(productError)
    ? await supabase.from('products').select(productSelectWithoutChain).eq('id', id).single()
    : null
  const activeProduct = fallbackProductRes?.data ?? product
  const activeProductError = fallbackProductRes?.error ?? productError

  const [{ data: collections }, { data: categories }, { data: tags }, { data: metalColors }, { data: metalPurities }] =
    await Promise.all([
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

  if (activeProductError) {
    console.error('[EditProductPage] products:', activeProductError.message, '| id:', id)
  }
  if (!activeProduct) notFound()

  let collection_ids: string[] = []
  const { data: collectionLinks, error: collLinksErr } = await supabase
    .from('collection_products')
    .select('collection_id')
    .eq('product_id', activeProduct.id)

  if (!collLinksErr && collectionLinks?.length) {
    collection_ids = collectionLinks.map((r) => r.collection_id)
  } else if (activeProduct.collection_id) {
    collection_ids = [activeProduct.collection_id]
  }

  const { data: tagLinks } = await supabase
    .from('product_tags')
    .select('tag_id')
    .eq('product_id', activeProduct.id)

  const tag_ids = (tagLinks ?? []).map((r) => r.tag_id)

  const colorGroupRows = await fetchProductColorGroups(supabase, activeProduct.id)
  const sizeStockRows = await fetchProductSizeStocks(supabase, activeProduct.id)

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

  const matrix = ((activeProduct.product_variants ?? []) as Array<{
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
        pricingContext={pricingContext}
        initialData={{
          id: activeProduct.id,
          product: {
            name: activeProduct.name,
            slug: activeProduct.slug,
            category_id: activeProduct.category_id ?? '',
            collection_id: activeProduct.collection_id,
            collection_ids: collection_ids.length > 0 ? collection_ids : undefined,
            tag_ids: tag_ids.length > 0 ? tag_ids : undefined,
            product_number: activeProduct.product_number,
            design_number: activeProduct.design_number ?? null,
            short_desc: activeProduct.short_desc,
            description: activeProduct.description,
            diamond_shape: activeProduct.diamond_shape,
            diamond_count: activeProduct.diamond_count,
            total_diamond_wt: activeProduct.total_diamond_wt,
            diamond_color: activeProduct.diamond_color,
            diamond_clarity: activeProduct.diamond_clarity,
            size_range: activeProduct.size_range,
            chain_lengths: (activeProduct as { chain_lengths?: unknown }).chain_lengths ?? [],
            metal_weight_g:
              activeProduct.metal_weight_g != null && Number.isFinite(Number(activeProduct.metal_weight_g))
                ? Number(activeProduct.metal_weight_g)
                : null,
            meta_title: activeProduct.meta_title,
            meta_description: activeProduct.meta_description,
            status: activeProduct.status,
            is_featured: activeProduct.is_featured,
            is_new_arrival: activeProduct.is_new_arrival,
            is_best_seller: activeProduct.is_best_seller,
            is_coming_soon: activeProduct.is_coming_soon,
          making_charge_pct: Number(activeProduct.making_charge_pct ?? 8),
          has_stone: Boolean(activeProduct.has_stone),
          stone_lines: activeProduct.stone_lines ?? [],
          size_stocks: sizeStockRows,
        },
          colorVariants,
          matrix,
        }}
      />
    </div>
  )
}
