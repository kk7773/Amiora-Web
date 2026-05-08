import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { createServerClient } from '@amiora/database'
import { attachCardPrice } from '@/lib/pricing/attachCardPrice'
import { getLatestPrices }       from '@/lib/pricing/engine'
import { ProductCard }           from '@/components/product/ProductCard'
import { FilterSidebar }         from '@/components/shop/FilterSidebar'
import { SortDropdown }          from '@/components/shop/SortDropdown'
import { Pagination }            from '@/components/shop/Pagination'
import { MobileFilterDrawer }    from '@/components/shop/MobileFilterDrawer'

export const revalidate = 300

const PAGE_SIZE = 12

interface Props {
  params:       Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

// Cache the collection lookup — shared between generateMetadata and CollectionPage
// so the DB is only queried once per revalidation window
const getCollection = unstable_cache(
  async (slug: string) => {
    const supabase = createServerClient()
    const { data } = await supabase.from('collections').select('*').eq('slug', slug).eq('is_active', true).single()
    return data as { id: string; name: string; slug: string; description: string | null; banner_url: string | null; thumb_url: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string } | null
  },
  ['collection-by-slug'],
  { revalidate: 300, tags: ['collections'] }
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getCollection(slug)
  if (!data) return {}
  return { title: data.name, description: data.description ?? undefined }
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp       = await searchParams
  const page     = parseInt(sp['page'] ?? '1', 10)

  // getCollection is cached — no extra DB hit if generateMetadata already called it
  const [collection, prices] = await Promise.all([
    getCollection(slug),
    getLatestPrices(),
  ])

  if (!collection) notFound()

  const supabase = createServerClient()

  const { data: rows, count } = await supabase
    .from('products')
    .select('id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,collection:collections(slug),category:categories(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(*)', { count: 'exact' })
    .eq('status', 'active')
    .eq('collection_id', collection.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  type RawProduct = {
    id: string; name: string; slug: string; making_charge_pct: number
    product_images: { url: string; is_primary: boolean }[]
    product_color_groups?: Array<{ id: string; color_id: string; images: string[] | null; display_order: number; is_active: boolean }>
    product_variants: { id: string; sku: string; price: number; stock_qty: number; is_active: boolean }[]
  }

  const products = (((rows ?? []) as unknown as RawProduct[]) ?? []).map((p) => {
    // If product_images is empty, generate from product_color_groups
    let images = p.product_images ?? []
    if (images.length === 0 && p.product_color_groups && p.product_color_groups.length > 0) {
      // Collect all images from color groups
      const colorGroupImages: { url: string; alt_text: string | null; is_primary: boolean; is_hover: boolean }[] = []
      for (let i = 0; i < p.product_color_groups.length; i++) {
        const cg = p.product_color_groups[i]
        if (cg && Array.isArray(cg.images)) {
          for (let j = 0; j < cg.images.length; j++) {
            const imgUrl = cg.images[j]
            colorGroupImages.push({
              url: imgUrl,
              alt_text: `${p.name} — image ${colorGroupImages.length + 1}`,
              is_primary: colorGroupImages.length === 0, // First image is primary
              is_hover: colorGroupImages.length === 1,   // Second image is hover
            })
          }
        }
      }
      images = colorGroupImages
    }
    
    return attachCardPrice(
      {
        ...p,
        product_images: images,
        collectionSlug: (p as RawProduct & { collection?: { slug?: string } | null }).collection?.slug ?? null,
        categorySlug: (p as RawProduct & { category?: { slug?: string } | null }).category?.slug ?? null,
        product_variants: p.product_variants ?? [],
      },
      prices.gold?.pricePerGram ?? 7200,
      prices.silver?.pricePerGram ?? 90
    )
  })

  return (
    <div>
      {/* Collection banner */}
      <div className="relative h-64 md:h-96 overflow-hidden bg-surface">
        {collection.banner_url && (
          <Image src={collection.banner_url} alt={collection.name} fill className="object-cover" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-deep-teal/60 to-transparent" />
        <div className="absolute inset-0 section-x flex items-end pb-10">
          {/* Breadcrumb */}
          <div className="space-y-2">
            <nav className="flex items-center gap-1 text-xs text-cream/60">
              <Link href="/" className="hover:text-cream transition-colors">Home</Link>
              <span>/</span>
              <Link href="/shop/collections" className="hover:text-cream transition-colors">Collections</Link>
              <span>/</span>
              <span className="text-cream">{collection.name}</span>
            </nav>
            <h1 className="font-display text-4xl md:text-5xl text-white">{collection.name}</h1>
            {collection.description && (
              <p className="text-sm text-cream/70 max-w-md">{collection.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="section-x py-10 flex gap-10">
        <div className="hidden lg:block w-56 shrink-0">
          <Suspense><FilterSidebar /></Suspense>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <Suspense><MobileFilterDrawer /></Suspense>
            <p className="text-sm text-ink-muted">{count ?? 0} pieces</p>
            <Suspense><SortDropdown /></Suspense>
          </div>
          {products.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <p className="text-2xs uppercase tracking-widest2 text-teal">Coming Soon</p>
              <p className="font-display text-2xl text-ink">Something Exquisite is Being Crafted</p>
              <p className="text-sm text-ink-muted max-w-sm mx-auto">
                Our artisans are putting the finishing touches on this collection. Check back soon.
              </p>
              <div className="flex justify-center gap-3 pt-4">
                <Link href="/customization" className="px-5 py-2.5 bg-deep-teal text-cream text-sm rounded-md hover:bg-teal transition-colors">
                  Request Custom Piece
                </Link>
                <Link href="/shop" className="px-5 py-2.5 border border-divider text-sm rounded-md hover:border-teal hover:text-teal transition-colors">
                  Browse All
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p as Parameters<typeof ProductCard>[0]['product']} />
              ))}
            </div>
          )}
          <Suspense><Pagination total={count ?? 0} pageSize={PAGE_SIZE} page={page} /></Suspense>
        </div>
      </div>
    </div>
  )
}
