import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@amiora/database'
import { ProductDetailClient } from '@/components/product/ProductDetailClient'
import { ProductCard }         from '@/components/product/ProductCard'
import { ReviewsSection }      from '@/components/product/ReviewsSection'
import { ProductFAQ }          from '@/components/product/ProductFAQ'
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { getLatestPrices }   from '@/lib/pricing/engine'

interface Props { params: Promise<{ slug: string }> }

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.amioradiamonds.in'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params
    const supabase  = createServerClient()
    const { data }  = await supabase
      .from('products')
      .select('name, short_description, product_images(url, is_primary)')
      .eq('slug', slug)
      .single()
    if (!data) return {}
    const imgs = (data.product_images ?? []) as { url: string; is_primary: boolean }[]
    const primaryImage = imgs.find(i => i.is_primary)?.url ?? imgs[0]?.url
    const title       = `${data.name} — AMIORA Jewellery`
    const description = data.short_description ?? `Explore ${data.name} — crafted in gold, silver & diamonds by AMIORA.`
    return {
      title, description,
      openGraph: { title, description, url: `${BASE}/products/${slug}`, images: primaryImage ? [{ url: primaryImage }] : [], type: 'website' },
      twitter:   { card: 'summary_large_image', title, description, images: primaryImage ? [primaryImage] : [] },
      alternates: { canonical: `${BASE}/products/${slug}` },
    }
  } catch {
    return {}
  }
}

// ISR: cache product pages for 60s, regenerate in background on next request
export const revalidate    = 60
export const dynamicParams = true   // on-demand ISR for slugs not pre-built

export default async function ProductPage({ params }: Props) {
  const { slug }  = await params
  const supabase  = createServerClient()

  // ── Round 1: Product + live prices run IN PARALLEL ─────────────────────────
  const [{ data: product, error: productError }, prices] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name, slug, short_description, description, making_charge_pct,
        making_charge_discount_pct, gem_price_discount_pct, faqs,
        collection:collections(id, name, slug),
        category:categories(id, name, slug),
        product_images(id, url, alt_text, sort_order, variant_id, is_primary),
        product_variants(
          id, purity, weight_grams, gem_weight_ct, gem_price_override, stock_status, is_active,
          metal_variant_id, gem_variant_id,
          metal_variant:metal_variants(variant_name),
          gem_variant:gem_variants(cut_name),
          sizes:product_sizes(*)
        )
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single(),
    getLatestPrices().catch(() => ({ gold: null, silver: null })),
  ])

  if (productError) {
    console.error('[ProductPage] query error:', productError.message, '| slug:', slug)
  }
  if (!product) notFound()

  // ── Round 2: Reviews + smart-pairs + you-may-also-like (all parallel) ───────
  type SmartPairRow = { paired_product_id: string }
  type ReviewRow    = { id: string; reviewer_name: string | null; rating: number; title: string | null; body: string | null; created_at: string; is_verified_purchase: boolean }
  type SuggestedProduct = {
    id: string
    name: string
    slug: string
    making_charge_pct: number
    making_charge_discount_pct: number | null
    gem_price_discount_pct: number | null
    product_images: { url: string; is_primary: boolean; is_hover: boolean; alt_text: string | null }[]
    product_variants: {
      id: string
      purity: string
      weight_grams: number | null
      gem_price_override: number | null
      stock_status: string
      making_charge_discount_pct: number | null
      gem_price_discount_pct: number | null
    }[]
  }

  const currentCollectionId = (product.collection as unknown as { id: string } | null)?.id ?? null

  const [reviewsRes, smartPairsRes, suggestedRes] = await Promise.all([
    Promise.resolve(
      supabase
        .from('reviews')
        .select('id, reviewer_name, rating, title, body, created_at, is_verified_purchase')
        .eq('product_id', product.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
    ).then(r => (r.data ?? []) as ReviewRow[]).catch(() => [] as ReviewRow[]),

    Promise.resolve(
      supabase
        .from('smart_pairs')
        .select('paired_product_id')
        .eq('product_id', product.id)
        .limit(6)
    ).then(r => ((r.data ?? []) as SmartPairRow[]).map(x => x.paired_product_id).filter(Boolean))
     .catch(() => [] as string[]),

    // Fetch products from OTHER collections (not the current product's collection)
    Promise.resolve(
      currentCollectionId
        ? supabase
            .from('products')
            .select('id, name, slug, making_charge_pct, making_charge_discount_pct, gem_price_discount_pct, product_images(url, is_primary, is_hover, alt_text), product_variants(*)')
            .neq('collection_id', currentCollectionId)
            .neq('id', product.id)
            .eq('is_active', true)
            .limit(8)
        : supabase
            .from('products')
            .select('id, name, slug, making_charge_pct, making_charge_discount_pct, gem_price_discount_pct, product_images(url, is_primary, is_hover, alt_text), product_variants(*)')
            .neq('id', product.id)
            .eq('is_active', true)
            .limit(8)
    ).then(r => (r.data ?? []) as SuggestedProduct[]).catch(() => [] as SuggestedProduct[]),
  ])

  const reviews             = reviewsRes
  const smartPairProductIds = smartPairsRes
  const suggestedProducts   = suggestedRes

  // ── Round 3: Paired products (conditional, smart-pair IDs known) ────────────
  type PairedProduct = {
    id: string
    name: string
    slug: string
    making_charge_pct: number
    making_charge_discount_pct: number | null
    gem_price_discount_pct: number | null
    product_images: { url: string; is_primary: boolean }[]
    product_variants: {
      purity: string
      weight_grams: number | null
      gem_price_override: number | null
      making_charge_discount_pct: number | null
      gem_price_discount_pct: number | null
      stock_status: string
    }[]
  }
  let pairedProducts: PairedProduct[] = []
  if (smartPairProductIds.length) {
    pairedProducts = await Promise.resolve(
      supabase
        .from('products')
        .select('id, name, slug, making_charge_pct, making_charge_discount_pct, gem_price_discount_pct, product_images(*), product_variants(*)')
        .in('id', smartPairProductIds)
        .eq('is_active', true)
    ).then(r => (r.data ?? []) as PairedProduct[]).catch(() => [])
  }

  const goldPrice   = (prices as { gold?: { pricePerGram: number } | null }).gold?.pricePerGram   ?? 7200
  const silverPrice = (prices as { silver?: { pricePerGram: number } | null }).silver?.pricePerGram ?? 90

  // ── Smart pairs with prices ───────────────────────────────────────────────
  const smartPairs = pairedProducts.map(p =>
    attachCardPrice(
      { ...p, product_variants: p.product_variants ?? [] },
      goldPrice,
      silverPrice
    )
  ) as Parameters<typeof ProductCard>[0]['product'][]

  // ── You May Also Like — products from other collections with prices ──────
  const youMayAlsoLike = suggestedProducts.map(p =>
    attachCardPrice(
      { ...p, product_variants: p.product_variants ?? [] },
      goldPrice,
      silverPrice
    )
  ) as Parameters<typeof ProductCard>[0]['product'][]

  // ── Review stats ──────────────────────────────────────────────────────────
  const safeReviews = (reviews ?? []).map(r => ({
    ...r,
    reviewer_name: r.reviewer_name ?? 'Anonymous',
  }))
  const avgRating = safeReviews.length
    ? safeReviews.reduce((s, r) => s + r.rating, 0) / safeReviews.length
    : 0

  // ── JSON-LD ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgs = ((product.product_images ?? []) as any[]).map((img: any, idx: number) => ({
    id:         String(img.id        ?? `img-${idx}`),
    url:        String(img.url       ?? ''),
    alt_text:   img.alt_text != null  ? String(img.alt_text) : null,
    sort_order: Number(img.sort_order ?? idx),
    variant_id: img.variant_id != null ? String(img.variant_id) : null,
  }))
  const primaryImg = (product.product_images as any[])?.find((i: any) => i.is_primary)?.url ?? imgs[0]?.url
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        product.name,
    description: product.short_description ?? '',
    image:       primaryImg ?? '',
    url:         `${BASE}/products/${slug}`,
    brand:       { '@type': 'Brand', name: 'AMIORA' },
    ...(safeReviews.length > 0 && {
      aggregateRating: {
        '@type':      'AggregateRating',
        ratingValue:  avgRating.toFixed(1),
        reviewCount:  safeReviews.length,
        bestRating:   5,
        worstRating:  1,
      },
    }),
  }

  // Explicit type that matches VariantSelector's Variant interface exactly
  type NormalizedVariant = {
    id:                 string
    purity:             string
    metal_variant_id:   string | null
    gem_variant_id:     string | null
    weight_grams:       number | null
    gem_price_override: number | null
    gem_weight_ct:      number | null
    stock_status:       string
    making_charge_discount_pct: number | null
    gem_price_discount_pct:     number | null
    metal_variant:      { variant_name: string } | null
    gem_variant:        { cut_name: string }     | null
    sizes:              { size_label: string; in_stock: boolean }[]
  }

  // Supabase returns foreign-key joins as arrays — normalize to single objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedVariants: NormalizedVariant[] = (product.product_variants ?? []).map((v: any): NormalizedVariant => {
    const rawMetal = Array.isArray(v.metal_variant) ? v.metal_variant[0] : v.metal_variant
    const rawGem   = Array.isArray(v.gem_variant)   ? v.gem_variant[0]   : v.gem_variant

    return {
      id:                 String(v.id   ?? ''),
      purity:             String(v.purity ?? ''),
      metal_variant_id:   v.metal_variant_id   != null ? String(v.metal_variant_id)   : null,
      gem_variant_id:     v.gem_variant_id     != null ? String(v.gem_variant_id)     : null,
      weight_grams:       v.weight_grams       != null ? Number(v.weight_grams)       : null,
      gem_price_override: v.gem_price_override != null ? Number(v.gem_price_override) : null,
      gem_weight_ct:      v.gem_weight_ct      != null ? Number(v.gem_weight_ct)      : null,
      stock_status:       String(v.stock_status ?? 'in_stock'),
      making_charge_discount_pct:
        v.making_charge_discount_pct != null && v.making_charge_discount_pct !== ''
          ? Number(v.making_charge_discount_pct)
          : null,
      gem_price_discount_pct:
        v.gem_price_discount_pct != null && v.gem_price_discount_pct !== ''
          ? Number(v.gem_price_discount_pct)
          : null,
      metal_variant:      rawMetal ? { variant_name: String(rawMetal.variant_name ?? '') } : null,
      gem_variant:        rawGem   ? { cut_name:     String(rawGem.cut_name       ?? '') } : null,
      sizes: Array.isArray(v.sizes)
        ? v.sizes.map((s: any) => ({ size_label: String(s.size_label ?? ''), in_stock: Boolean(s.in_stock) }))
        : [],
    }
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <ProductDetailClient
        product={{
          id:                product.id,
          name:              product.name,
          short_description: product.short_description,
          making_charge_pct: product.making_charge_pct,
          making_charge_discount_pct: Number((product as { making_charge_discount_pct?: number | null }).making_charge_discount_pct ?? 0),
          gem_price_discount_pct:     Number((product as { gem_price_discount_pct?: number | null }).gem_price_discount_pct ?? 0),
          avgRating,
          reviewCount:    safeReviews.length,
          collectionName: (product.collection as unknown as { name: string } | null)?.name ?? null,
          collectionSlug: (product.collection as unknown as { slug: string } | null)?.slug ?? null,
          categoryName:   (product.category   as unknown as { name: string } | null)?.name ?? null,
        }}
        variants={normalizedVariants}
        images={imgs}
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
