import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@amiora/database'
import { PRODUCT_CATEGORY_EMBED, PRODUCT_COLLECTION_EMBED } from '@/lib/shop/mapProductForCard'
import ShopPage from '../page'
import CollectionPage from '../../collections/[slug]/page'
import CategoryPage from '../../categories/[slug]/page'
import ProductPage from '../../products/[slug]/page'
import { PriceListingPage } from '@/components/shop/PriceListingPage'
import { parseShopSegments, shopListingPathRedirect } from '@/lib/shop/paths'
import {
  parsePriceListingPath,
  parsePriceListingSlug,
  shopPriceListingPathRedirect,
} from '@/lib/shop/priceListingSlugs'
import { resolveShopCanonicalPath } from '@/lib/shop/resolveShopCanonical'
import { canonicalFromPath } from '@/lib/seo/site'

interface Props {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<Record<string, string | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: segments } = await params
  const path = await resolveShopCanonicalPath(segments)
  return { alternates: { canonical: canonicalFromPath(path) } }
}

const FILTER_MAP: Record<string, Record<string, string>> = {
  all: {},
  gold: { metal: 'gold' },
  diamond: { diamond: 'true' },
  '22k': { purity: '22k' },
  '18k': { purity: '18k' },
  '14k': { purity: '14k' },
  '9k': { purity: '9k' },
}

function mergeListingSearchParams(
  listing: { sort: string; page: number },
  segments: string[],
  sp: Record<string, string | undefined>,
) {
  const legacy =
    segments[0] === 'page' ||
    segments[0] === 'sort' ||
    segments.includes('page') ||
    (segments.length >= 2 && segments[1] === 'sort')

  if (legacy) {
    return { ...sp, sort: listing.sort, page: String(listing.page) }
  }

  return {
    ...sp,
    sort: sp.sort ?? listing.sort,
    page: sp.page ?? String(listing.page),
  }
}

export default async function ShopCatchAllPage({ params, searchParams }: Props) {
  const { slug: segments } = await params
  const sp = await searchParams

  const shopPath = `/shop/${segments.join('/')}`

  const legacyPriceRedirect = shopPriceListingPathRedirect(shopPath)
  if (legacyPriceRedirect) redirect(legacyPriceRedirect)

  const legacyRedirect = shopListingPathRedirect(shopPath)
  if (legacyRedirect) redirect(legacyRedirect)

  if (segments.length === 1 && parsePriceListingSlug(segments[0]!)) {
    const listing = parsePriceListingPath(shopPath)
    if (listing) return <PriceListingPage listing={listing} />
  }

  if (segments[0] === 'collections') {
    if (segments.length === 1) redirect('/collections')
    if (segments.length === 2) redirect(`/shop/${segments[1]}`)
  }

  if (segments.length === 2 && !['page', 'sort'].includes(segments[0]!)) {
    const [parentSlug, productSlug] = segments
    const supabase = createServerClient()
    const { data: product } = await supabase
      .from('products')
      .select(`slug, collection:${PRODUCT_COLLECTION_EMBED}(slug), category:${PRODUCT_CATEGORY_EMBED}(slug)`)
      .eq('slug', productSlug)
      .in('status', ['active', 'make_to_order'])
      .single()

    if (!product) notFound()

    const collectionSlug = (product.collection as { slug?: string } | null)?.slug ?? null
    const categorySlug = (product.category as { slug?: string } | null)?.slug ?? null
    if (parentSlug !== collectionSlug && parentSlug !== categorySlug) notFound()

    return ProductPage({ params: Promise.resolve({ slug: productSlug }) })
  }

  const listing = parseShopSegments(segments)
  if (!listing) notFound()

  const { scopeSlug, sort, page } = listing

  const shopSearchParams = mergeListingSearchParams({ sort, page }, segments, sp)

  if (!scopeSlug || scopeSlug === 'all') {
    return ShopPage({
      searchParams: Promise.resolve(shopSearchParams),
    })
  }

  if (scopeSlug in FILTER_MAP) {
    return ShopPage({
      searchParams: Promise.resolve({
        ...FILTER_MAP[scopeSlug]!,
        ...shopSearchParams,
      }),
    })
  }

  const supabase = createServerClient()
  const [{ data: collection }, { data: category }] = await Promise.all([
    supabase.from('collections').select('slug').eq('slug', scopeSlug).eq('is_active', true).maybeSingle(),
    supabase.from('categories').select('slug').eq('slug', scopeSlug).eq('is_active', true).maybeSingle(),
  ])

  if (collection?.slug) {
    return CollectionPage({
      params: Promise.resolve({ slug: scopeSlug }),
      searchParams: Promise.resolve(shopSearchParams),
    })
  }

  if (category?.slug) {
    return CategoryPage({
      params: Promise.resolve({ slug: scopeSlug }),
      searchParams: Promise.resolve(shopSearchParams),
    })
  }

  notFound()
}
