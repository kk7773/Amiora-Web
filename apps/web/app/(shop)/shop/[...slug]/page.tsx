import { notFound } from 'next/navigation'
import { createServerClient } from '@amiora/database'
import ShopPage from '../page'
import CollectionPage from '../../collections/[slug]/page'
import CategoryPage from '../../categories/[slug]/page'
import ProductPage from '../../products/[slug]/page'
import { parseShopSegments } from '@/lib/shop/paths'

interface Props {
  params: Promise<{ slug: string[] }>
}

const FILTER_MAP: Record<string, Record<string, string>> = {
  all: {},
  gold: { metal: 'gold' },
  silver: { metal: 'silver' },
  diamond: { diamond: 'true' },
  '18k': { purity: '18k' },
  '14k': { purity: '14k' },
  '9k': { purity: '9k' },
}

export default async function ShopCatchAllPage({ params }: Props) {
  const { slug: segments } = await params

  if (segments.length === 2 && !['page', 'sort'].includes(segments[0]!)) {
    const [parentSlug, productSlug] = segments
    const supabase = createServerClient()
    const { data: product } = await supabase
      .from('products')
      .select('slug, collection:collections(slug), category:categories(slug)')
      .eq('slug', productSlug)
      .eq('status', 'active')
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

  if (!scopeSlug || scopeSlug === 'all') {
    return ShopPage({
      searchParams: Promise.resolve({
        sort,
        page: String(page),
      }),
    })
  }

  if (scopeSlug in FILTER_MAP) {
    return ShopPage({
      searchParams: Promise.resolve({
        ...FILTER_MAP[scopeSlug]!,
        sort,
        page: String(page),
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
      searchParams: Promise.resolve({
        sort,
        page: String(page),
      }),
    })
  }

  if (category?.slug) {
    return CategoryPage({
      params: Promise.resolve({ slug: scopeSlug }),
      searchParams: Promise.resolve({
        sort,
        page: String(page),
      }),
    })
  }

  notFound()
}
