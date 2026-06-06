export const DEFAULT_SHOP_SORT = 'newest'

export type ShopListingState = {
  scopeSlug: string | null
  sort: string
  page: number
}

export type ListingQueryParams = {
  page?: number
  sort?: string
}

export function getCollectionsIndexHref() {
  return '/collections'
}

export function getCollectionHref(slug: string) {
  return `/shop/${slug}`
}

/** Strip /shop/ or /collections/ prefix into listing segments. */
export function pathnameToListingSegments(pathname: string): string[] {
  const normalized = pathname.replace(/\/$/, '')
  if (normalized === '/shop' || normalized === '/collections') return []
  if (normalized.startsWith('/shop/')) {
    return normalized.replace(/^\/shop\/?/, '').split('/').filter(Boolean)
  }
  if (normalized.startsWith('/collections/')) {
    const slug = normalized.replace(/^\/collections\/?/, '').split('/').filter(Boolean)[0]
    return slug ? [slug] : []
  }
  return []
}

export function appendListingQuery(href: string, query: ListingQueryParams = {}) {
  const params = new URLSearchParams()
  if (query.page != null && query.page > 1) params.set('page', String(query.page))
  if (query.sort && query.sort !== DEFAULT_SHOP_SORT) params.set('sort', query.sort)
  const qs = params.toString()
  return qs ? `${href}?${qs}` : href
}

export function buildListingHref(
  state: Partial<ShopListingState> = {},
  query: ListingQueryParams = {},
  basePath: '/shop' | '/collections' = '/shop',
) {
  if (basePath === '/collections' && state.scopeSlug) {
    return appendListingQuery(`/collections/${state.scopeSlug}`, {
      page: state.page,
      sort: state.sort,
    })
  }
  const href = buildShopListingHref(state)
  return appendListingQuery(href, query)
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function parseShopSegments(segments: string[] = []): ShopListingState | null {
  if (segments.length === 0) {
    return { scopeSlug: null, sort: DEFAULT_SHOP_SORT, page: 1 }
  }

  if (segments[0] === 'page') {
    return { scopeSlug: null, sort: DEFAULT_SHOP_SORT, page: normalizePage(segments[1]) }
  }

  if (segments[0] === 'sort') {
    return { scopeSlug: null, sort: segments[1] ?? DEFAULT_SHOP_SORT, page: 1 }
  }

  if (segments.length === 1) {
    return { scopeSlug: segments[0]!, sort: DEFAULT_SHOP_SORT, page: 1 }
  }

  if (segments.length === 3 && segments[1] === 'page') {
    return { scopeSlug: segments[0]!, sort: DEFAULT_SHOP_SORT, page: normalizePage(segments[2]) }
  }

  if (segments.length === 3 && segments[1] === 'sort') {
    return { scopeSlug: segments[0]!, sort: segments[2] ?? DEFAULT_SHOP_SORT, page: 1 }
  }

  if (segments.length === 5 && segments[1] === 'sort' && segments[3] === 'page') {
    return { scopeSlug: segments[0]!, sort: segments[2] ?? DEFAULT_SHOP_SORT, page: normalizePage(segments[4]) }
  }

  return null
}

export function buildShopListingHref(state: Partial<ShopListingState> = {}) {
  const scopeSlug = state.scopeSlug ?? null
  const sort = state.sort ?? DEFAULT_SHOP_SORT
  const page = state.page ?? 1

  const parts = ['/shop']
  if (scopeSlug) parts.push(scopeSlug)
  if (sort !== DEFAULT_SHOP_SORT) parts.push('sort', sort)
  if (page > 1) parts.push('page', String(page))
  return parts.join('/')
}

export function getProductHref(product: {
  slug: string
  collectionSlug?: string | null
  categorySlug?: string | null
}) {
  const parentSlug = product.collectionSlug ?? product.categorySlug
  return parentSlug ? `/shop/${parentSlug}/${product.slug}` : `/products/${product.slug}`
}
