import type { Metadata } from 'next'
import { createServerClient } from '@amiora/database'
import { canonicalFromPath, getSiteUrl } from '@/lib/seo/site'

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  title: 'AMIORA Jewellery — Premium Gold, Silver & Diamond Jewelry',
  description: 'Discover AMIORA\'s exclusive collection of handcrafted gold, silver and diamond jewellery. Live pricing, custom orders, and free shipping across India.',
  openGraph: {
    title: 'AMIORA Jewellery — Premium Gold, Silver & Diamond Jewelry',
    description: 'Explore exquisite handcrafted jewellery with live pricing and personalised service.',
    url: SITE_URL,
    type: 'website',
    images: [{ url: `${SITE_URL}/og-home.jpg`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: canonicalFromPath('/') },
}

export const revalidate = 300
import { HeroBanner }          from '@/components/sections/HeroBanner'
import { MarqueeStrip }        from '@/components/sections/MarqueeStrip'
// import { PriceTicker }         from '@/components/sections/PriceTicker'
import { FeaturedCollections } from '@/components/sections/FeaturedCollections'
import { ProductGridSection }  from '@/components/sections/ProductGridSection'
import { MaterialShowcase }    from '@/components/sections/MaterialShowcase'
import { CustomizationCTA }    from '@/components/sections/CustomizationCTA'
import { Testimonials }        from '@/components/sections/Testimonials'
import { BlogPreview }         from '@/components/sections/BlogPreview'
import { StoreLocatorTeaser }   from '@/components/sections/StoreLocatorTeaser'
import { StoreCitiesSection }   from '@/components/sections/StoreCitiesSection'
import { FaqSection }           from '@/components/sections/FaqSection'
import { HOME_FAQS }              from '@/lib/content/homeFaqs'
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { fetchPurityMapForProducts } from '@/lib/pricing/fetchPurityMap'
import { getLatestPrices } from '@/lib/pricing/engine'
import { resolveProductCardImages } from '@/lib/shop/resolveProductCardImages'
import { fetchActiveProductCards } from '@/lib/shop/fetchProductCards'
import { JsonLd } from '@/components/seo/JsonLd'
import { pickVisibleStores } from '@/lib/storefrontStore'
import {
  buildCollectionListJsonLd,
  buildFaqPageJsonLd,
  buildItemListJsonLd,
  buildWebPageJsonLd,
  toSchemaProductItem,
} from '@/lib/seo/jsonLd'

export default async function HomePage() {
  const supabase = createServerClient()

  // Fetch all homepage data in parallel
  const [
    { data: collections },
    newArrivalsResult,
    bestSellersResult,
    topPicksResult,
    { data: testimonials },
    { data: blogs },
    { data: stores },
    { data: siteFaqs },
    prices,
  ] = await Promise.all([
    supabase.from('collections').select('id,name,slug,banner_url,description').eq('is_active', true).order('sort_order').limit(4),
    fetchActiveProductCards(supabase, {
      apply: (q) => q.eq('is_new_arrival', true),
      order: { column: 'created_at', ascending: false },
      limit: 10,
    }),
    fetchActiveProductCards(supabase, {
      apply: (q) => q.or('is_best_seller.eq.true,is_featured.eq.true'),
      order: { column: 'created_at', ascending: false },
      limit: 10,
    }),
    fetchActiveProductCards(supabase, {
      order: { column: 'created_at', ascending: false },
      limit: 10,
    }),
    supabase.from('testimonials').select('id,name,location,quote,rating').eq('is_featured', true).order('sort_order').limit(8),
    supabase.from('blogs').select('id,title,slug,excerpt,cover_url,tags,published_at').eq('is_published', true).order('published_at', { ascending: false }).limit(3),
    supabase
      .from('stores')
      .select('id, name, address, city, state, pincode, maps_url, lat, lng, image_url')
      .eq('is_active', true)
      .order('city'),
    supabase.from('site_faqs').select('id, question, answer').eq('is_active', true).order('sort_order').order('created_at'),
    getLatestPrices(),
  ])

  const newArrivalRows = newArrivalsResult.products
  const bestSellerRows = bestSellersResult.products
  const topPickRows = topPicksResult.products

  if (newArrivalsResult.error) {
    console.error('[HomePage] new arrivals:', newArrivalsResult.error)
  }
  if (bestSellersResult.error) {
    console.error('[HomePage] best sellers:', bestSellersResult.error)
  }
  if (topPicksResult.error) {
    console.error('[HomePage] top picks:', topPicksResult.error)
  }

  type RawProduct = {
    id: string
    name: string
    slug: string
    making_charge_pct: number
    making_charge_discount_pct?: number | null
    gem_price_discount_pct?: number | null
    product_images?: { url: string; alt_text: string | null; is_primary: boolean; is_hover: boolean }[] | null
    product_color_groups?: Array<{ id: string; color_id: string; images: string[] | null; display_order: number; is_active: boolean }> | null
    product_variants?: { id: string; sku: string; price: number; stock_qty: number; is_active?: boolean }[] | null
    collection?: { slug?: string } | null
    category?: { slug?: string } | null
  }

  const allHomeProducts = [
    ...(newArrivalRows ?? []),
    ...(bestSellerRows ?? []),
    ...(topPickRows ?? []),
  ]
  const purityMap = await fetchPurityMapForProducts(supabase, allHomeProducts)

  const attachPrice = (rows: typeof newArrivalRows) =>
    (rows ?? []).map((p) => {
      const raw = p as RawProduct
      const images = resolveProductCardImages(
        raw.name,
        raw.product_images,
        raw.product_color_groups,
      )

      return attachCardPrice(
        {
          ...p,
          collectionSlug: (p.collection as { slug?: string } | null)?.slug ?? null,
          categorySlug: (p.category as { slug?: string } | null)?.slug ?? null,
          making_charge_discount_pct: p.making_charge_discount_pct,
          gem_price_discount_pct: p.gem_price_discount_pct,
          product_images: images,
          product_variants: p.product_variants ?? [],
        },
        prices.gold?.pricePerGram ?? 7200,
        prices.silver?.pricePerGram ?? 90,
        purityMap,
      )
    })

  const newArrivals = attachPrice(newArrivalRows)

  const featuredBestSellerRows =
    bestSellerRows.length > 0
      ? bestSellerRows
      : (
          await fetchActiveProductCards(supabase, {
            order: { column: 'created_at', ascending: false },
            limit: 10,
          })
        ).products

  const bestSellers = attachPrice(featuredBestSellerRows)
  const monthlyTopPicks = attachPrice(
    [...(topPickRows ?? [])]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
  )

  // Group stores by city for the city cards section
  type StoreRow = {
    id: string
    name?: string | null
    address?: string | null
    city: string
    state?: string | null
    pincode?: string | null
    maps_url?: string | null
    lat?: number | null
    lng?: number | null
    image_url: string | null
  }
  const storeRows   = pickVisibleStores((stores ?? []) as StoreRow[])
  const storeCount  = storeRows.length

  const cityMap = new Map<string, { count: number; image_url: string | null }>()
  for (const s of storeRows) {
    const existing = cityMap.get(s.city)
    if (existing) {
      existing.count++
      if (!existing.image_url && s.image_url) existing.image_url = s.image_url
    } else {
      cityMap.set(s.city, { count: 1, image_url: s.image_url })
    }
  }
  const citiesData = Array.from(cityMap.entries()).map(([city, v]) => ({
    city,
    count:     v.count,
    image_url: v.image_url,
  }))

  const featuredProducts = [...newArrivals, ...bestSellers]
    .filter((product, index, list) => list.findIndex((item) => item.slug === product.slug) === index)
    .slice(0, 20)
    .map((product) =>
      toSchemaProductItem(product as { name: string; slug: string; basePrice?: number; product_images?: { url: string; is_primary?: boolean }[] }),
    )

  const homeSchemas: Record<string, unknown>[] = [
    buildWebPageJsonLd({
      name: 'AMIORA Jewellery — Premium Gold, Silver & Diamond Jewelry',
      description:
        'Discover AMIORA\'s exclusive collection of handcrafted gold, silver and diamond jewellery. Live pricing, custom orders, and free shipping across India.',
      path: '/',
    }),
    buildItemListJsonLd({
      name: 'Featured Jewellery',
      path: '/',
      items: featuredProducts,
    }),
    buildCollectionListJsonLd({
      name: 'Featured Collections',
      path: '/',
      items: (collections ?? []).map((col) => ({
        name: col.name,
        slug: col.slug,
        description: col.description,
        image: col.banner_url,
      })),
    }),
  ]

  const dbFaqs = (siteFaqs ?? []) as { id: string; question: string; answer: string }[]
  const displayFaqs =
    dbFaqs.length > 0
      ? dbFaqs.slice(0, 5)
      : HOME_FAQS.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))

  if (displayFaqs.length > 0) {
    homeSchemas.push(buildFaqPageJsonLd(displayFaqs))
  }

  return (
    <>
      <JsonLd data={homeSchemas} />
      <HeroBanner />
      <MarqueeStrip />
      {/* <PriceTicker /> */}
      <FeaturedCollections collections={collections ?? []} />
      <ProductGridSection
        heading="New Arrivals"
        viewAllHref="/shop"
        products={newArrivals as Parameters<typeof ProductGridSection>[0]['products']}
        columns={5}
      />
      <MaterialShowcase />
      <ProductGridSection
        heading="Best Sellers"
        viewAllHref="/shop?sort=popular"
        products={bestSellers as Parameters<typeof ProductGridSection>[0]['products']}
        columns={5}
      />
      <ProductGridSection
        heading="This Month’s Top Picks"
        viewAllHref="/shop"
        products={monthlyTopPicks as Parameters<typeof ProductGridSection>[0]['products']}
        columns={5}
      />
      <CustomizationCTA />
      <Testimonials testimonials={testimonials ?? []} />
      <BlogPreview posts={blogs ?? []} />
      <FaqSection faqs={displayFaqs} />
      <StoreCitiesSection cities={citiesData} />
      <StoreLocatorTeaser storeCount={storeCount} cities={citiesData.map((city) => city.city)} />
    </>
  )
}
