import type { Metadata } from 'next'
import { createServerClient } from '@amiora/database'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.amioradiamonds.in'

export const metadata: Metadata = {
  title: 'AMIORA Jewellery — Premium Gold, Silver & Diamond Jewelry',
  description: 'Discover AMIORA\'s exclusive collection of handcrafted gold, silver and diamond jewellery. Live pricing, custom orders, and free shipping across India.',
  openGraph: {
    title: 'AMIORA Jewellery — Premium Gold, Silver & Diamond Jewelry',
    description: 'Explore exquisite handcrafted jewellery with live pricing and personalised service.',
    url: BASE,
    type: 'website',
    images: [{ url: `${BASE}/og-home.jpg`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: BASE },
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
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { getLatestPrices }     from '@/lib/pricing/engine'

export default async function HomePage() {
  const supabase = createServerClient()

  // Fetch all homepage data in parallel
  const [
    { data: collections },
    { data: newArrivalRows },
    { data: bestSellerRows },
    { data: topPickRows },
    { data: testimonials },
    { data: blogs },
    { data: stores },
    { data: siteFaqs },
    prices,
  ] = await Promise.all([
    supabase.from('collections').select('id,name,slug,banner_url,description').eq('is_active', true).order('sort_order').limit(4),
    supabase.from('products').select('id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,collection:collections(slug),category:categories(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(*)').eq('status', 'active').eq('is_new_arrival', true).order('created_at', { ascending: false }).limit(10),
    supabase.from('products').select('id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,collection:collections(slug),category:categories(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(*)').eq('status', 'active').or('is_best_seller.eq.true,is_featured.eq.true').order('created_at', { ascending: false }).limit(10),
    supabase.from('products').select('id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,collection:collections(slug),category:categories(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(*)').eq('status', 'active').order('created_at', { ascending: false }).limit(40),
    supabase.from('testimonials').select('id,name,location,quote,rating').eq('is_featured', true).order('sort_order').limit(8),
    supabase.from('blogs').select('id,title,slug,excerpt,cover_url,tags,published_at').eq('is_published', true).order('published_at', { ascending: false }).limit(3),
    supabase.from('stores').select('id, city, image_url').eq('is_active', true).order('city'),
    supabase.from('site_faqs').select('id, question, answer').eq('is_active', true).order('sort_order').order('created_at'),
    getLatestPrices(),
  ])

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

  const attachPrice = (rows: typeof newArrivalRows) =>
    (rows ?? []).map((p) => {
      let images = (p as RawProduct).product_images ?? []
      if (images.length === 0 && Array.isArray((p as RawProduct).product_color_groups)) {
        const colorGroupImages: { url: string; alt_text: string | null; is_primary: boolean; is_hover: boolean }[] = []
        for (const cg of (p as RawProduct).product_color_groups ?? []) {
          if (!cg || !Array.isArray(cg.images)) continue
          for (const imgUrl of cg.images) {
            if (typeof imgUrl !== 'string' || imgUrl.trim() === '') continue
            colorGroupImages.push({
              url: imgUrl,
              alt_text: `${(p as RawProduct).name} — image ${colorGroupImages.length + 1}`,
              is_primary: colorGroupImages.length === 0,
              is_hover: colorGroupImages.length === 1,
            })
          }
        }
        images = colorGroupImages
      }

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
        prices.silver?.pricePerGram ?? 90
      )
    })

  const newArrivals = attachPrice(newArrivalRows)

  const featuredBestSellerRows = Array.isArray(bestSellerRows) && bestSellerRows.length > 0
    ? bestSellerRows
    : await supabase
        .from('products')
        .select('id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,collection:collections(slug),category:categories(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(*)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10)
        .then((res) => res.data ?? [])

  const bestSellers = attachPrice(featuredBestSellerRows)
  const monthlyTopPicks = attachPrice(
    [...(topPickRows ?? [])]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
  )

  // Group stores by city for the city cards section
  type StoreRow = { id: string; city: string; image_url: string | null }
  const storeRows   = (stores ?? []) as StoreRow[]
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

  return (
    <>
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
        viewAllHref="/shop/sort/popular"
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
      <StoreCitiesSection cities={citiesData} />
      <FaqSection faqs={(siteFaqs ?? []) as { id: string; question: string; answer: string }[]} />
      <StoreLocatorTeaser storeCount={storeCount} />
    </>
  )
}
