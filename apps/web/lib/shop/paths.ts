export const DEFAULT_SHOP_SORT = 'newest'

export type ShopListingState = {
  scopeSlug: string | null
  sort: string
  page: number
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
