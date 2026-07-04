import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerClient } from '@amiora/database'
import { fetchShopListing, SHOP_PAGE_SIZE } from '@/lib/shop/fetchShopListing'
import { ShopListingClient } from '@/components/shop/ShopListingClient'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildListingPageSchemas, toSchemaProductItem } from '@/lib/seo/jsonLd'
import { canonicalFromPath } from '@/lib/seo/site'
import { FilterSidebar }         from '@/components/shop/FilterSidebar'
import { MobileFilterDrawer }    from '@/components/shop/MobileFilterDrawer'

export const revalidate = 300

// ── Per-category visual accent colours (Tailwind safe-list friendly) ──────────
const CATEGORY_META: Record<string, { gradient: string; tagline: string }> = {
  rings:      { gradient: 'from-[#b8860b]/30 to-[#2d6a4f]/10', tagline: 'From solitaires to eternity bands — crafted to last a lifetime.' },
  necklaces:  { gradient: 'from-[#4a6fa5]/30 to-[#b8860b]/10', tagline: 'Delicate chains and statement pieces that frame every neckline.' },
  earrings:   { gradient: 'from-[#7b2d8b]/20 to-[#b8860b]/10', tagline: 'Studs, drops & hoops — a pair for every mood and moment.' },
  bangles:    { gradient: 'from-[#c0392b]/20 to-[#b8860b]/10', tagline: 'Stack them, layer them — gold bangles that speak tradition.' },
  bracelets:  { gradient: 'from-[#1a535c]/30 to-[#b8860b]/10', tagline: 'Tennis bracelets, charm chains, and everything between.' },
  pendants:   { gradient: 'from-[#2d6a4f]/30 to-[#b8860b]/10', tagline: 'Meaningful pieces — pendants that carry your story.' },
  chains:     { gradient: 'from-[#6c3483]/20 to-[#b8860b]/10', tagline: 'Gold and silver chains in every length and link style.' },
  sets:       { gradient: 'from-[#b8860b]/30 to-[#1a535c]/10', tagline: 'Curated matching sets — necklace, earrings & more in perfect harmony.' },
}

interface Props {
  params:       Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase  = createServerClient()
  const { data }  = await supabase
    .from('categories')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return {}
  return {
    title: data.name,
    description: data.description ?? `Shop ${data.name} — handcrafted gold, silver & diamond jewellery by AMIORA.`,
    alternates: { canonical: canonicalFromPath(`/shop/${slug}`) },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp       = await searchParams
  const page     = parseInt(sp['page'] ?? '1', 10)
  const sort     = sp['sort'] ?? 'newest'
  const metal    = sp['metal']?.split(',').filter(Boolean) ?? []
  const purity   = sp['purity']?.split(',').filter(Boolean) ?? []
  const diamond  = sp['diamond'] === 'true'
  const diamondShape = sp['diamond_shape']?.split(',').filter(Boolean) ?? []
  const catArr   = sp['category']?.split(',').filter(Boolean) ?? []

  const headersList = await headers()
  const canonicalPath = headersList.get('x-canonical-path') ?? ''
  if (canonicalPath.startsWith('/categories/')) {
    redirect(`/shop/${slug}`)
  }

  const supabase = createServerClient()

  const { data: category } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!category) notFound()

  const { products, total } = await fetchShopListing(supabase, {
    page,
    sort,
    metal,
    purity,
    diamond,
    diamondShape,
    category: [...new Set([slug, ...catArr])],
  })

  const meta = CATEGORY_META[slug] ?? {
    gradient: 'from-deep-teal/20 to-light-teal/10',
    tagline:  `Handcrafted ${category.name.toLowerCase()} jewellery made to cherish.`,
  }

  const schemaProducts = products.map((p) =>
    toSchemaProductItem(p as { name: string; slug: string; basePrice?: number; product_images?: { url: string; is_primary?: boolean }[] }),
  )

  return (
    <div>
      <JsonLd
        data={buildListingPageSchemas({
          name: category.name,
          description: category.description ?? meta.tagline,
          path: `/shop/${slug}`,
          breadcrumb: [
            { name: 'Home', href: '/' },
            { name: 'Shop', href: '/shop' },
            { name: category.name, href: `/shop/${slug}` },
          ],
          products: schemaProducts,
          total,
        })}
      />
      {/* ── Category banner ─────────────────────────────────── */}
      <div className={`relative h-56 md:h-80 overflow-hidden bg-gradient-to-br ${meta.gradient} bg-surface`}>
        {category.image_url && (
          <Image
            src={category.image_url}
            alt={category.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-deep-teal/70 via-deep-teal/40 to-transparent" />
        <div className="absolute inset-0 section-x flex items-end pb-10">
          <div className="space-y-2">
            <nav className="flex items-center gap-1.5 text-xs text-cream/60">
              <Link href="/" className="hover:text-cream transition-colors">Home</Link>
              <span>/</span>
              <Link href="/shop" className="hover:text-cream transition-colors">Shop</Link>
              <span>/</span>
              <span className="text-cream">{category.name}</span>
            </nav>
            <h1 className="font-display text-4xl md:text-5xl text-white">{category.name}</h1>
            <p className="text-sm text-cream/70 max-w-md">
              {category.description ?? meta.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────── */}
      {products.length === 0 ? (
        /* ── COMING SOON ── */
        <ComingSoon categoryName={category.name} slug={slug} />
      ) : (
        /* ── PRODUCT GRID ── */
        <div className="section-x py-10 flex gap-10">
          <div className="hidden lg:block w-56 shrink-0">
            <Suspense><FilterSidebar /></Suspense>
          </div>
          <div className="flex-1 min-w-0">
            <Suspense><MobileFilterDrawer /></Suspense>
            <Suspense>
              <ShopListingClient
                initialProducts={products as Parameters<typeof ShopListingClient>[0]['initialProducts']}
                total={total}
                pageSize={SHOP_PAGE_SIZE}
                initialPage={page}
                initialSort={sort}
                filters={{ category: [...new Set([slug, ...catArr])], metal, purity, diamondShape }}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Coming Soon state — shown when category has no products yet
// ─────────────────────────────────────────────────────────────────
function ComingSoon({ categoryName, slug }: { categoryName: string; slug: string }) {
  const OTHER_CATEGORIES = [
    { name: 'Rings',      slug: 'rings'      },
    { name: 'Necklaces',  slug: 'necklaces'  },
    { name: 'Earrings',   slug: 'earrings'   },
    { name: 'Bangles',    slug: 'bangles'    },
    { name: 'Bracelets',  slug: 'bracelets'  },
    { name: 'Pendants',   slug: 'pendants'   },
    { name: 'Sets',       slug: 'sets'       },
  ].filter((c) => c.slug !== slug)

  return (
    <div className="section-x py-20">
      {/* Hero message */}
      <div className="max-w-2xl mx-auto text-center space-y-6">
        {/* Diamond icon */}
        <div className="flex justify-center">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 bg-gradient-to-br from-teal/20 to-light-teal/30 rounded-full animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-10 h-10 text-teal fill-current opacity-80">
                <path d="M20 4 L36 14 L36 26 L20 36 L4 26 L4 14 Z" />
                <path d="M20 4 L4 14 L20 22 L36 14 Z" className="opacity-50" />
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-2xs uppercase tracking-widest2 text-teal">Coming Soon</p>
          <h2 className="font-display text-display-xl text-ink">
            Something Exquisite<br />is Being Crafted
          </h2>
          <p className="text-ink-muted leading-relaxed max-w-md mx-auto">
            Our master artisans are putting the final touches on our{' '}
            <span className="text-deep-teal font-medium">{categoryName}</span> collection.
            Each piece is handcrafted with precision — worth the wait.
          </p>
        </div>

        {/* Decorative divider */}
        <div className="flex items-center gap-4 justify-center">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-teal/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-teal/60" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-teal/40" />
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/customization"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-md hover:bg-teal transition-colors"
          >
            Request a Custom Piece
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-divider text-ink text-sm font-medium uppercase tracking-widest rounded-md hover:border-teal hover:text-teal transition-colors"
          >
            Browse All Jewellery
          </Link>
        </div>
      </div>

      {/* Browse other categories */}
      <div className="mt-20">
        <p className="text-center text-xs uppercase tracking-widest2 text-ink-faint mb-6">
          Explore Other Categories
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {OTHER_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/shop/${c.slug}`}
              className="px-5 py-2 rounded-full border border-divider text-sm text-ink-muted hover:border-teal hover:text-teal transition-colors"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
