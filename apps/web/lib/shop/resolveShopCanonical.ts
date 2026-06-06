import { createServerClient } from '@amiora/database'
import { DEFAULT_SHOP_SORT, parseShopSegments } from '@/lib/shop/paths'

const FILTER_SCOPES = new Set(['all', 'gold', 'silver', 'diamond', '18k', '14k', '9k'])

function buildShopPath(scopeSlug: string | null, sort: string, page: number) {
  const parts = ['/shop']
  if (scopeSlug && scopeSlug !== 'all') parts.push(scopeSlug)
  if (sort !== DEFAULT_SHOP_SORT) parts.push('sort', sort)
  if (page > 1) parts.push('page', String(page))
  return parts.join('/')
}

/** Preferred canonical pathname for `/shop/[...slug]` routes. */
export async function resolveShopCanonicalPath(segments: string[]): Promise<string> {
  if (segments[0] === 'collections') {
    if (segments.length === 2) return `/shop/${segments[1]}`
    return '/collections'
  }

  if (segments.length === 2 && !['page', 'sort'].includes(segments[0]!)) {
    const [parentSlug, productSlug] = segments
    const supabase = createServerClient()
    const { data: product } = await supabase
      .from('products')
      .select('slug, collection:collections(slug), category:categories(slug)')
      .eq('slug', productSlug)
      .eq('status', 'active')
      .single()

    if (product) {
      const collectionSlug = (product.collection as { slug?: string } | null)?.slug ?? null
      const categorySlug = (product.category as { slug?: string } | null)?.slug ?? null
      if (parentSlug === collectionSlug || parentSlug === categorySlug) {
        return `/products/${productSlug}`
      }
    }
  }

  const listing = parseShopSegments(segments)
  if (!listing) return `/shop/${segments.join('/')}`

  const { scopeSlug, sort, page } = listing

  if (!scopeSlug || FILTER_SCOPES.has(scopeSlug)) {
    return buildShopPath(scopeSlug, sort, page)
  }

  const supabase = createServerClient()
  const [{ data: collection }, { data: category }] = await Promise.all([
    supabase.from('collections').select('slug').eq('slug', scopeSlug).eq('is_active', true).maybeSingle(),
    supabase.from('categories').select('slug').eq('slug', scopeSlug).eq('is_active', true).maybeSingle(),
  ])

  if (collection?.slug) {
    return page <= 1 && sort === DEFAULT_SHOP_SORT ? `/collections/${scopeSlug}` : buildShopPath(scopeSlug, sort, page)
  }

  if (category?.slug) {
    return buildShopPath(scopeSlug, sort, page)
  }

  return buildShopPath(scopeSlug, sort, page)
}
