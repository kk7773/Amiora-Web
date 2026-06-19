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

/** @deprecated Use buildShopListingHref — pagination/sort are client-side. */
export function buildListingHref(state: Partial<ShopListingState> = {}) {
  return buildShopListingHref({ scopeSlug: state.scopeSlug })
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

/** Shop scope href — fixed path only; pagination/sort are client-side. */
export function buildShopListingHref(state: Partial<ShopListingState> = {}) {
  const scopeSlug = state.scopeSlug ?? null
  if (!scopeSlug || scopeSlug === 'all') return '/shop'
  return `/shop/${scopeSlug}`
}

function segmentsUseLegacyPagination(segments: string[]) {
  return (
    segments[0] === 'page' ||
    segments[0] === 'sort' ||
    segments.includes('page') ||
    (segments.length >= 2 && segments[1] === 'sort')
  )
}

type SearchParamsLike =
  | { get(key: string): string | null }
  | Record<string, string | undefined>
  | null
  | undefined

function readSearchParam(sp: SearchParamsLike, key: string): string | null {
  if (!sp) return null
  if (typeof (sp as { get?: (k: string) => string | null }).get === 'function') {
    return (sp as { get(key: string): string | null }).get(key)
  }
  return (sp as Record<string, string | undefined>)[key] ?? null
}

/** Current listing state from pathname + search params (query wins over clean paths). */
export function resolveShopListingState(
  pathname: string,
  searchParams?: SearchParamsLike,
): ShopListingState {
  const segments = pathnameToListingSegments(pathname)
  const fromPath = parseShopSegments(segments)
  if (!fromPath) {
    return { scopeSlug: null, sort: DEFAULT_SHOP_SORT, page: 1 }
  }

  if (segmentsUseLegacyPagination(segments)) {
    return fromPath
  }

  const sortParam = readSearchParam(searchParams, 'sort')
  const pageParam = readSearchParam(searchParams, 'page')

  return {
    scopeSlug: fromPath.scopeSlug,
    sort: sortParam ?? fromPath.sort,
    page: pageParam ? normalizePage(pageParam) : fromPath.page,
  }
}

/** Redirect legacy `/shop/.../page/N` paths to clean scope URLs (pagination is client-side). */
export function shopListingPathRedirect(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, '')
  if (!normalized.startsWith('/shop/')) return null

  const segments = normalized.replace(/^\/shop\/?/, '').split('/').filter(Boolean)
  if (!segmentsUseLegacyPagination(segments)) return null

  const listing = parseShopSegments(segments)
  if (!listing) return null

  const scope = listing.scopeSlug && listing.scopeSlug !== 'all' ? listing.scopeSlug : null
  return scope ? `/shop/${scope}` : '/shop'
}

export function getProductHref(product: {
  slug: string
  collectionSlug?: string | null
  categorySlug?: string | null
}) {
  const parentSlug = product.collectionSlug ?? product.categorySlug
  return parentSlug ? `/shop/${parentSlug}/${product.slug}` : `/products/${product.slug}`
}

export function getCartItemHref(item: {
  productSlug?: string
  collectionSlug?: string | null
  categorySlug?: string | null
}) {
  if (!item.productSlug) return '/shop'
  return getProductHref({
    slug: item.productSlug,
    collectionSlug: item.collectionSlug,
    categorySlug: item.categorySlug,
  })
}
