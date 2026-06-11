import { createServerClient } from '@amiora/database'
import { parseShopSegments } from '@/lib/shop/paths'

const FILTER_SCOPES = new Set(['all', 'gold', 'silver', 'diamond', '18k', '14k', '9k'])

function shopScopePath(scopeSlug: string | null) {
  return scopeSlug && scopeSlug !== 'all' ? `/shop/${scopeSlug}` : '/shop'
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

  const { scopeSlug } = listing

  if (!scopeSlug || FILTER_SCOPES.has(scopeSlug)) {
    return shopScopePath(scopeSlug)
  }

  const supabase = createServerClient()
  const [{ data: collection }, { data: category }] = await Promise.all([
    supabase.from('collections').select('slug').eq('slug', scopeSlug).eq('is_active', true).maybeSingle(),
    supabase.from('categories').select('slug').eq('slug', scopeSlug).eq('is_active', true).maybeSingle(),
  ])

  if (collection?.slug) {
    return shopScopePath(scopeSlug)
  }

  if (category?.slug) {
    return shopScopePath(scopeSlug)
  }

  return shopScopePath(scopeSlug)
}
