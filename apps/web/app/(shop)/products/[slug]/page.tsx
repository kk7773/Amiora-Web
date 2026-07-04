import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createServerClient } from '@amiora/database'
import { ProductDetailClient } from '@/components/product/ProductDetailClient'
import { ProductCard }         from '@/components/product/ProductCard'
import { ReviewsSection }      from '@/components/product/ReviewsSection'
import { ProductFAQ }          from '@/components/product/ProductFAQ'
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { fetchPurityMapForProducts } from '@/lib/pricing/fetchPurityMap'
import { getLatestPrices } from '@/lib/pricing/engine'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildProductPageSchemas } from '@/lib/seo/jsonLd'
import { canonicalFromPath } from '@/lib/seo/site'
import { mapProductForCard, PRODUCT_CARD_SELECT, PRODUCT_CATEGORY_EMBED, PRODUCT_COLLECTION_EMBED, type ProductCardRaw } from '@/lib/shop/mapProductForCard'

interface Props {
  params: Promise<{ slug: string }>
}

type CatalogBundle = {
  catalogColorGroups: {
    colorId: string
    code: string
    label: string
    hex: string | null
    images: string[]
    videos: string[]
  }[]
  catalogPurities: { id: string; code: string; label: string; display_order: number; metal?: string }[]
  catalogVariants: {
    id: string
    color_id: string
    purity_id: string
    sku: string
    price: number
    stock_qty: number
    metal_weight_g: number | null
    is_active: boolean
    price_breakup?: unknown
  }[]
}

function isCatalogVariantRow(r: Record<string, unknown>): boolean {
  return (
    typeof r.color_id === 'string' &&
    typeof r.purity_id === 'string' &&
    typeof r.sku === 'string' &&
    (typeof r.price === 'number' || typeof r.price === 'string')
  )
}

async function legacyVariantCatalog(
  supabase: ReturnType<typeof createServerClient>,
  product: { id: string; slug: string; sku?: string | null },
  variantRecords: Record<string, unknown>[],
  fallbackImageUrls: string[],
): Promise<CatalogBundle> {
  const productSku = typeof product.sku === 'string' ? product.sku : product.slug

  const legacy = variantRecords.filter((r) => typeof r.id === 'string') as Array<{
    id: string
    is_active?: boolean
    metal_variant_id?: string | null
    purity?: unknown
    gem_price_override?: unknown
    stock_status?: unknown
  }>

  const mvIds = [
    ...new Set(legacy.map((r) => r.metal_variant_id).filter((x): x is string => typeof x === 'string')),
  ]

  const mvMeta = new Map<string, string>()
  if (mvIds.length > 0) {
    const { data: mvs } = await supabase.from('metal_variants').select('id, variant_name').in('id', mvIds)
    for (const m of mvs ?? []) {
      if (m && typeof m.id === 'string') {
        mvMeta.set(m.id, typeof m.variant_name === 'string' ? m.variant_name : m.id)
      }
    }
  }

  const puritiesUniq = [...new Set(legacy.map((r) => String(r.purity ?? '').trim()).filter(Boolean))]
  const catalogPurities = puritiesUniq.map((p, i) => ({
    id:        `legacy-pur:${p}`,
    code:      p,
    label:     p,
    display_order: i,
  }))

  const colorKeys = mvIds.length > 0 ? mvIds : ['legacy-default']
  const catalogColorGroups = colorKeys.map((cid) => {
    const label = mvMeta.get(cid) ?? (cid === 'legacy-default' ? 'Default' : 'Metal')
    const code  = label.replace(/\s+/g, '-').toLowerCase().slice(0, 24) || 'metal'
    return { colorId: cid, code, label, hex: null as string | null, images: fallbackImageUrls, videos: [] as string[] }
  })

  const catalogVariants = legacy.map((v) => {
    const purityKey = String(v.purity ?? 'default').trim() || 'default'
    const inStock     = v.stock_status !== 'out_of_stock'
    return {
      id:         v.id,
      color_id:   typeof v.metal_variant_id === 'string' ? v.metal_variant_id : 'legacy-default',
      purity_id:  `legacy-pur:${purityKey}`,
      sku:        `${productSku}-${v.id.slice(0, 8)}`,
      price:      Number(v.gem_price_override ?? 0),
      stock_qty:  inStock ? 99 : 0,
      metal_weight_g: null,
      is_active:  v.is_active !== false,
      price_breakup: null,
    }
  })

  return { catalogColorGroups, catalogPurities, catalogVariants }
}

/** Normalized shape the PDP expects (works after 010 or on legacy `products`). */
type PdpProductRow = {
  id: string
  name: string
  slug: string
  short_desc: string | null
  description: string | null
  faqs: unknown | null
  diamond_shape: string | null
  diamond_count: number | null
  total_diamond_wt: number | null
  diamond_color: string | null
  diamond_clarity: string | null
  size_range: string | null
  design_number: string | null
  making_charge_pct: number | null
  making_charge_discount_pct: number | null
  gem_price_discount_pct: number | null
  stone_lines?: unknown
  collection: unknown
  category: unknown
  product_images: unknown
  sku?: string | null
}

const PDP_PRODUCT_MODERN_SELECT = `
  id, name, slug, design_number, short_desc, description, faqs,
  diamond_shape, diamond_count, total_diamond_wt, diamond_color, diamond_clarity, size_range,
  making_charge_pct, making_charge_discount_pct, gem_price_discount_pct,
  has_stone, stone_lines,
  collection:${PRODUCT_COLLECTION_EMBED}(id, name, slug),
  category:${PRODUCT_CATEGORY_EMBED}(id, name, slug),
  product_images(id, url, alt_text, sort_order, is_primary)
`

const PDP_PRODUCT_LEGACY_SELECT = `
  id, name, slug, description, short_description, sku,
  making_charge_pct,
  collection:${PRODUCT_COLLECTION_EMBED}(id, name, slug),
  category:${PRODUCT_CATEGORY_EMBED}(id, name, slug),
  product_images(id, url, alt_text, sort_order, is_primary)
`

const PCG_BASE_SELECT = `
  id, color_id, images, display_order, is_active,
  color:metal_colors(id, label, code, hex, display_order)
`

const PCG_WITH_VIDEOS_SELECT = `
  id, color_id, images, videos, display_order, is_active,
  color:metal_colors(id, label, code, hex, display_order)
`

type PcgFetchRow = {
  id: string
  color_id: string
  images: string[] | null
  videos?: string[] | null
  display_order: number
  is_active?: boolean
  color:
    | { id: string; label: string; code: string; hex: string | null; display_order: number }
    | [{ id: string; label: string; code: string; hex: string | null; display_order: number }]
    | null
}

function isVideosColumnMissing(message: string) {
  return /videos/i.test(message) && /(column|schema cache|does not exist|42703)/i.test(message)
}

/** Tolerates DBs that have not yet applied migration 018 (product_color_groups.videos). */
async function fetchProductColorGroups(
  supabase: ReturnType<typeof createServerClient>,
  productId: string,
): Promise<{ data: PcgFetchRow[]; error: { message: string; code?: string } | null }> {
  const withVideos = await supabase
    .from('product_color_groups')
    .select(PCG_WITH_VIDEOS_SELECT)
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (!withVideos.error) {
    return { data: (withVideos.data ?? []) as PcgFetchRow[], error: null }
  }

  if (!isVideosColumnMissing(withVideos.error.message)) {
    return { data: [], error: withVideos.error as { message: string; code?: string } }
  }

  const withoutVideos = await supabase
    .from('product_color_groups')
    .select(PCG_BASE_SELECT)
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (withoutVideos.error) {
    return { data: [], error: withoutVideos.error as { message: string; code?: string } }
  }

  const rows = ((withoutVideos.data ?? []) as PcgFetchRow[]).map((row) => ({
    ...row,
    videos: [] as string[],
  }))
  return { data: rows, error: null }
}

async function fetchPdpProductImpl(
  supabase: ReturnType<typeof createServerClient>,
  slug: string,
): Promise<{ data: PdpProductRow | null; error: { message: string; code?: string } | null }> {
  const modern = await supabase
    .from('products')
    .select(PDP_PRODUCT_MODERN_SELECT)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  const modernCode = (modern.error as { code?: string } | null)?.code
  if (!modern.error && modern.data) {
    return { data: modern.data as PdpProductRow, error: null }
  }

  if (modern.error && modernCode !== '42703') {
    return { data: null, error: modern.error as { message: string; code?: string } }
  }

  const leg = await supabase
    .from('products')
    .select(PDP_PRODUCT_LEGACY_SELECT)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (leg.error || !leg.data) {
    return { data: null, error: (leg.error ?? modern.error) as { message: string; code?: string } }
  }

  const r = leg.data as Record<string, unknown>
  const row: PdpProductRow = {
    id:                         r.id as string,
    name:                       r.name as string,
    slug:                       r.slug as string,
    design_number:              null,
    short_desc:                 (r.short_description as string | null) ?? null,
    description:                (r.description as string | null) ?? null,
    faqs:                       null,
    diamond_shape:              null,
    diamond_count:              null,
    total_diamond_wt:           null,
    diamond_color:              null,
    diamond_clarity:            null,
    size_range:                 null,
    making_charge_pct:          (r.making_charge_pct as number | null) ?? null,
    making_charge_discount_pct: null,
    gem_price_discount_pct:     null,
    collection:                 r.collection,
    category:                   r.category,
    product_images:             r.product_images,
    sku:                        (r.sku as string | null) ?? null,
  }
  return { data: row, error: null }
}

const fetchPdpProduct = cache((slug: string) =>
  unstable_cache(
    async () => fetchPdpProductImpl(createServerClient(), slug),
    ['pdp-product', slug],
    { revalidate: 120 },
  )(),
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params
    const { data } = await fetchPdpProduct(slug)
    if (!data) return {}
    type Img = { url: string; is_primary: boolean }
    const imgs = (data.product_images ?? []) as Img[]
    const primaryImage = imgs.find((i) => i.is_primary)?.url ?? imgs[0]?.url
    const title = `${data.name} — AMIORA Jewellery`
    const description =
      data.short_desc ?? `Explore ${data.name} — crafted in gold & diamonds by AMIORA.`
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonicalFromPath(`/products/${slug}`),
        images: primaryImage ? [{ url: primaryImage }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: primaryImage ? [primaryImage] : [],
      },
      alternates: { canonical: canonicalFromPath(`/products/${slug}`) },
    }
  } catch {
    return {}
  }
}

export const revalidate    = 60
export const dynamicParams = true

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: product, error: productError } = await fetchPdpProduct(slug)

  if (productError) {
    console.error('[ProductPage] query error:', productError.message, '| slug:', slug)
  }
  if (!product) notFound()

  const { data: variantRowsRaw, error: variantFetchError } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', product.id)

  if (variantFetchError) {
    console.error('[ProductPage] product_variants fetch error:', variantFetchError.message, '| slug:', slug)
  }

  const variantRecords = (variantRowsRaw ?? []) as Record<string, unknown>[]
  const catalogVariantSource = variantRecords.filter(isCatalogVariantRow)
  const useLegacyVariants      = catalogVariantSource.length === 0 && variantRecords.length > 0

  type PurRow = { id: string; label: string; code: string; display_order: number }
  const purityIdsForLookup = [
    ...new Set(catalogVariantSource.map((v) => v.purity_id as string).filter(Boolean)),
  ]

  const emptyPurities = Promise.resolve({ data: [] as PurRow[], error: null as null })

  /** Separate queries: avoid PostgREST embeds when FK relationships are missing from schema cache. */
  const [{ data: productColorGroupRows, error: pcgError }, { data: purityRows, error: purityErr }] =
    await Promise.all([
      fetchProductColorGroups(supabase, product.id),
      purityIdsForLookup.length > 0 && !useLegacyVariants
        ? supabase.from('metal_purities').select('id, label, code, display_order, metal').in('id', purityIdsForLookup)
        : emptyPurities,
    ])

  const pcgErrCode = (pcgError as { code?: string } | null)?.code
  if (pcgError && pcgErrCode !== 'PGRST205') {
    console.error('[ProductPage] product_color_groups error:', pcgError.message, '| slug:', slug)
  }
  if (purityErr) {
    console.error('[ProductPage] metal_purities error:', purityErr.message, '| slug:', slug)
  }

  type ImgRow = { id: string; url: string; alt_text: string | null; sort_order: number; is_primary: boolean }
  const fallbackImages: ImgRow[] = ((product.product_images ?? []) as ImgRow[])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)

  const rawGroups = (productColorGroupRows ?? [])
    .filter((row) => row.is_active !== false)
    .slice()
    .sort((a, b) => a.display_order - b.display_order)

  let catalogColorGroups = rawGroups.map((row) => {
    const mc = Array.isArray(row.color) ? row.color[0] : row.color
    return {
      colorId: mc?.id ?? row.color_id,
      code:    mc?.code ?? '',
      label:   mc?.label ?? '',
      hex:     mc?.hex ?? null,
      images:  row.images ?? [],
      videos:  row.videos ?? [],
    }
  })

  type Pvv = {
    id: string
    color_id: string
    purity_id: string
    sku: string
    price: number | string
    stock_qty: number
    metal_weight_g?: number | string | null
    is_active: boolean
    price_breakup?: unknown
  }

  let catalogPurities: { id: string; code: string; label: string; display_order: number; metal?: string }[] = []
  let catalogVariants: {
    id: string
    color_id: string
    purity_id: string
    sku: string
    price: number
    stock_qty: number
    metal_weight_g: number | null
    is_active: boolean
    price_breakup?: unknown
  }[] = []

  if (useLegacyVariants) {
    const urls = fallbackImages.map((i) => i.url)
    const built = await legacyVariantCatalog(supabase, product, variantRecords, urls)
    catalogColorGroups = built.catalogColorGroups
    catalogPurities    = built.catalogPurities
    catalogVariants    = built.catalogVariants
  } else {
    const rawVariants = catalogVariantSource as Pvv[]

    const purityMeta = new Map<string, { id: string; code: string; label: string; display_order: number }>()
    for (const r of purityRows ?? []) {
      purityMeta.set(r.id, r)
    }
    catalogPurities = [...purityMeta.values()].sort(
      (a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code),
    )

    catalogVariants = rawVariants
      .filter((variant) => variant.is_active !== false)
      .map((v) => ({
        id:         v.id,
        color_id:   v.color_id,
        purity_id:  v.purity_id,
        sku:        v.sku,
        price:      Number(v.price ?? 0),
        stock_qty:  typeof v.stock_qty === 'number' ? v.stock_qty : 0,
        metal_weight_g:
          v.metal_weight_g != null && Number.isFinite(Number(v.metal_weight_g))
            ? Number(v.metal_weight_g)
            : null,
        is_active:  v.is_active ?? true,
        price_breakup: v.price_breakup ?? null,
      }))

    if (catalogVariants.length > 0) {
      const activeColorIds = new Set(catalogVariants.map((variant) => variant.color_id))
      catalogColorGroups = catalogColorGroups.filter((group) => activeColorIds.has(group.colorId))
    }

    /** Colour groups derived from masters when PCC rows missing (legacy / partial CMS data). */
    if (catalogColorGroups.length === 0 && catalogVariants.length > 0) {
      const colorIds = [...new Set(catalogVariants.map((x) => x.color_id))]
      const { data: mcRows } = await supabase
        .from('metal_colors')
        .select('id, label, code, hex')
        .in('id', colorIds)
      const urls = fallbackImages.map((i) => i.url)
      for (const r of mcRows ?? []) {
        catalogColorGroups.push({
          colorId: r.id,
          code:    r.code,
          label:   r.label,
          hex:     r.hex,
          images:  urls.length > 0 ? urls : [],
          videos:  [],
        })
      }
    }
  }

  if (catalogColorGroups.length === 0 && catalogVariants.length === 0) {
    console.warn('[ProductPage] Product has no color groups or variants:', slug)
  }

  type SmartPairRow = { paired_product_id: string }
  type ReviewRow = {
    id: string
    reviewer_name: string | null
    rating: number
    title: string | null
    body: string | null
    created_at: string
    is_verified_purchase: boolean
  }

  type SuggestedProduct = ProductCardRaw

  const currentCollectionId = (product.collection as unknown as { id: string } | null)?.id ?? null

  const { data: myCollectionLinks } = await supabase
    .from('collection_products')
    .select('collection_id')
    .eq('product_id', product.id)

  const myCollectionIds = (myCollectionLinks ?? []).map((r) => r.collection_id)

  let suggestedProductIds: string[] = []
  if (myCollectionIds.length > 0) {
    const { data: siblingLinks } = await supabase
      .from('collection_products')
      .select('product_id')
      .in('collection_id', myCollectionIds)
      .neq('product_id', product.id)
    suggestedProductIds = [...new Set((siblingLinks ?? []).map((r) => r.product_id))].slice(0, 8)
  }

  const suggestedFetch =
    suggestedProductIds.length > 0
      ? supabase
          .from('products')
          .select(PRODUCT_CARD_SELECT)
          .in('id', suggestedProductIds)
          .eq('status', 'active')
      : currentCollectionId
        ? supabase
            .from('products')
            .select(PRODUCT_CARD_SELECT)
            .neq('collection_id', currentCollectionId)
            .neq('id', product.id)
            .eq('status', 'active')
            .limit(8)
        : supabase
            .from('products')
            .select(PRODUCT_CARD_SELECT)
            .neq('id', product.id)
            .eq('status', 'active')
            .limit(8)

  const [reviewsRes, smartPairsRes, suggestedRes] = await Promise.all([
    Promise.resolve(
      supabase
        .from('reviews')
        .select('id, reviewer_name, rating, title, body, created_at, is_verified_purchase')
        .eq('product_id', product.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
    ).then((r) => (r.data ?? []) as ReviewRow[]).catch(() => []),

    Promise.resolve(
      supabase.from('smart_pairs').select('paired_product_id').eq('product_id', product.id).limit(6),
    )
      .then((r) => ((r.data ?? []) as SmartPairRow[]).map((x) => x.paired_product_id).filter(Boolean))
      .catch(() => [] as string[]),

    Promise.resolve(suggestedFetch)
      .then((r) => (r.data ?? []) as SuggestedProduct[]).catch(() => []),
  ])

  const smartPairProductIds = smartPairsRes
  const suggestedProducts   = suggestedRes

  let pairedProducts: SuggestedProduct[] = []
  if (smartPairProductIds.length) {
    pairedProducts = await Promise.resolve(
      supabase
        .from('products')
        .select(PRODUCT_CARD_SELECT)
        .in('id', smartPairProductIds)
        .eq('status', 'active'),
    ).then((r) => (r.data ?? []) as SuggestedProduct[]).catch(() => [])
  }

  const { gold: liveGold, silver: liveSilver } = await getLatestPrices()
  const goldPrice = liveGold?.pricePerGram ?? 7200
  const silverPrice = liveSilver?.pricePerGram ?? 90

  const relatedForPricing = [...pairedProducts, ...suggestedProducts]
  const purityMap = await fetchPurityMapForProducts(supabase, relatedForPricing)

  const smartPairs = pairedProducts.map((p) =>
    mapProductForCard(p, goldPrice, silverPrice, purityMap),
  ) as Parameters<typeof ProductCard>[0]['product'][]

  const youMayAlsoLike = suggestedProducts.map((p) =>
    mapProductForCard(p, goldPrice, silverPrice, purityMap),
  ) as Parameters<typeof ProductCard>[0]['product'][]

  const safeReviews = (reviewsRes ?? []).map((r) => ({
    ...r,
    reviewer_name: r.reviewer_name ?? 'Anonymous',
  }))
  const avgRating = safeReviews.length
    ? safeReviews.reduce((s, r) => s + r.rating, 0) / safeReviews.length
    : 0

  const imgs = fallbackImages.map((img, idx) => ({
    id:         String(img.id ?? `img-${idx}`),
    url:        String(img.url ?? ''),
    alt_text:   img.alt_text != null ? String(img.alt_text) : null,
    sort_order: Number(img.sort_order ?? idx),
    variant_id: null as string | null,
  }))
  const primaryImg = imgs.find((i) => i.id && fallbackImages.find((f) => f.id === i.id)?.is_primary)?.url ?? imgs[0]?.url

  const purityMapForSchema = Object.fromEntries(
    catalogPurities.map((p) => [p.id, { code: p.code, metal: p.metal }]),
  )
  const schemaPrice = attachCardPrice(
    {
      making_charge_pct: Number(product.making_charge_pct ?? 0),
      making_charge_discount_pct: product.making_charge_discount_pct,
      gem_price_discount_pct: product.gem_price_discount_pct,
      stone_lines: product.stone_lines,
      product_variants: catalogVariants,
    },
    goldPrice,
    silverPrice,
    purityMapForSchema,
  ).basePrice

  const collectionMeta = product.collection as { name: string; slug: string } | null
  const categoryMeta = product.category as { name: string; slug: string } | null
  const productFaqs = (product.faqs as { question: string; answer: string }[] | null) ?? []

  const productSchemas = buildProductPageSchemas({
    product: {
      name: product.name,
      description: product.short_desc ?? `Explore ${product.name} — crafted in gold & diamonds by AMIORA.`,
      image: primaryImg,
      slug,
      price: schemaPrice,
      sku: catalogVariants[0]?.sku ?? null,
      reviewCount: safeReviews.length || undefined,
      avgRating: safeReviews.length ? avgRating : undefined,
      categoryName: categoryMeta?.name ?? null,
      collectionName: collectionMeta?.name ?? null,
    },
    breadcrumb: [
      { name: 'Home', href: '/' },
      ...(collectionMeta
        ? [{ name: collectionMeta.name, href: `/shop/${collectionMeta.slug}` }]
        : categoryMeta
          ? [{ name: categoryMeta.name, href: `/shop/${categoryMeta.slug}` }]
          : [{ name: 'Shop', href: '/shop' }]),
      { name: product.name, href: `/products/${slug}` },
    ],
    faqs: productFaqs,
  })

  return (
    <>
      <JsonLd data={productSchemas} />

      <ProductDetailClient
        product={{
          id:               product.id,
          name:             product.name,
          design_number:    product.design_number ?? null,
          short_desc:       product.short_desc,
          description:      product.description,
          diamond_shape:    product.diamond_shape,
          diamond_count:    product.diamond_count,
          total_diamond_wt: product.total_diamond_wt,
          diamond_color:    product.diamond_color,
          diamond_clarity:  product.diamond_clarity,
          size_range:       product.size_range,
          making_charge_pct: Number(product.making_charge_pct ?? 0),
          avgRating,
          reviewCount:     safeReviews.length,
          collectionName:  (product.collection as unknown as { name: string } | null)?.name ?? null,
          collectionSlug:  (product.collection as unknown as { slug: string } | null)?.slug ?? null,
          categoryName:    (product.category   as unknown as { name: string } | null)?.name ?? null,
          categorySlug:    (product.category   as unknown as { slug: string } | null)?.slug ?? null,
          slug:            slug,
        }}
        catalog={{
          colorGroups: catalogColorGroups,
          purities:    catalogPurities,
          variants:    catalogVariants,
        }}
        fallbackImages={fallbackImages}
        pricingContext={{
          makingChargePct: Number(product.making_charge_pct ?? 8),
          makingChargeDiscountPct: Number(product.making_charge_discount_pct ?? 0),
          gemPriceDiscountPct: Number(product.gem_price_discount_pct ?? 0),
          stoneLines: (product as { stone_lines?: unknown }).stone_lines ?? [],
          initialGoldPerGram: goldPrice,
          initialSilverPerGram: silverPrice,
        }}
      />

      {smartPairs.length > 0 && (
        <section className="section-x pb-14">
          <h2 className="font-display text-display-xl text-ink mb-8">Complete the Look</h2>
          <div className="flex gap-5 overflow-x-auto pb-4 hide-scrollbar">
            {smartPairs.map((p) => (
              <div key={p.id} className="w-56 shrink-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      <ProductFAQ faqs={(product.faqs as { question: string; answer: string }[] | null) ?? []} />

      <ReviewsSection
        productId={product.id}
        productName={product.name}
        reviews={safeReviews}
        total={safeReviews.length}
        avgRating={avgRating}
      />

      {youMayAlsoLike.length > 0 && (
        <section className="section-x py-14 border-t border-divider">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
            <div>
              <p className="text-2xs uppercase tracking-widest2 text-teal mb-2">Explore More</p>
              <h2 className="font-display text-display-xl text-ink">You May Also Like</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {youMayAlsoLike.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
