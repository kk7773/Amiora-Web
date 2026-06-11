import { DEFAULT_SHOP_SORT } from '@/lib/shop/paths'
import { PRICE_RANGE_BUCKETS, type PriceRangeBucket, type PriceRangeId } from '@/lib/shop/priceRanges'

/** URL prefix for all price-based listing pages (under /shop). */
export const SHOP_PRICE_BASE = '/shop'
/** @deprecated Use SHOP_PRICE_BASE — kept for legacy redirects */
export const PRODUCT_PRICE_BASE = SHOP_PRICE_BASE

/** Virtual "all jewellery" scope — not a DB category slug. */
export const JEWELLERY_SCOPE = 'jewellery'

/** DB category slugs (matches seed data). */
export const CATEGORY_SCOPES = [
  'rings',
  'necklaces',
  'earrings',
  'bangles',
  'bracelets',
  'pendants',
  'chains',
  'sets',
] as const

export type CategoryScope = (typeof CATEGORY_SCOPES)[number]
export type PriceListingScope = typeof JEWELLERY_SCOPE | CategoryScope

export const PRICE_LISTING_SCOPES: PriceListingScope[] = [
  JEWELLERY_SCOPE,
  ...CATEGORY_SCOPES,
]

const RANGE_SUFFIXES = PRICE_RANGE_BUCKETS.map((b) => b.id)
const RANGE_SUFFIX_PATTERN = RANGE_SUFFIXES.map((s) => s.replace(/-/g, '\\-')).join('|')
const SCOPE_PATTERN = [JEWELLERY_SCOPE, ...CATEGORY_SCOPES].join('|')

const BASE_SLUG_RE = new RegExp(`^(${SCOPE_PATTERN})-(${RANGE_SUFFIX_PATTERN})$`)

const SCOPE_LABELS: Record<PriceListingScope, string> = {
  jewellery: 'Jewellery',
  rings: 'Rings',
  necklaces: 'Necklaces',
  earrings: 'Earrings',
  bangles: 'Bangles',
  bracelets: 'Bracelets',
  pendants: 'Pendants',
  chains: 'Chains',
  sets: 'Sets',
}

export type PriceListingPath = {
  scope: PriceListingScope
  rangeId: PriceRangeId
  sort: string
  page: number
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function buildPriceListingSlug(scope: PriceListingScope, rangeId: PriceRangeId): string {
  return `${scope}-${rangeId}`
}

export function parsePriceListingSlug(slug: string): { scope: PriceListingScope; rangeId: PriceRangeId } | null {
  const match = slug.match(BASE_SLUG_RE)
  if (!match) return null
  return {
    scope: match[1] as PriceListingScope,
    rangeId: match[2] as PriceRangeId,
  }
}

function priceListingTailSegments(segments: string[]): Pick<PriceListingPath, 'sort' | 'page'> | null {
  let sort = DEFAULT_SHOP_SORT
  let page = 1

  if (segments.length === 0) {
    return { sort, page }
  }
  if (segments.length === 2 && segments[0] === 'page') {
    return { sort, page: normalizePage(segments[1]) }
  }
  if (segments.length === 2 && segments[0] === 'sort') {
    return { sort: segments[1] ?? DEFAULT_SHOP_SORT, page }
  }
  if (segments.length === 4 && segments[0] === 'sort' && segments[2] === 'page') {
    return {
      sort: segments[1] ?? DEFAULT_SHOP_SORT,
      page: normalizePage(segments[3]),
    }
  }
  return null
}

export function parsePriceListingPath(pathname: string): PriceListingPath | null {
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean)
  if (segments.length === 0) return null

  let slugSegment: string | undefined
  let tail: string[] = []

  if (segments[0] === 'shop' && segments.length >= 2) {
    slugSegment = segments[1]
    tail = segments.slice(2)
  } else if (segments[0] === 'product' && segments.length >= 2) {
    slugSegment = segments[1]
    tail = segments.slice(2)
  } else if (segments.length === 1) {
    slugSegment = segments[0]
    tail = []
  } else {
    return null
  }

  if (!slugSegment) return null

  const parsed = parsePriceListingSlug(slugSegment)
  if (!parsed) return null

  const tailState = priceListingTailSegments(tail)
  if (!tailState) return null

  return { ...parsed, ...tailState }
}

/** Clean shop URL for a price listing (pagination/sort are client-side). */
export function buildPriceListingHref(
  scope: PriceListingScope,
  rangeId: PriceRangeId,
  _state: { sort?: string; page?: number } = {},
) {
  return `${SHOP_PRICE_BASE}/${buildPriceListingSlug(scope, rangeId)}`
}

/** Redirect legacy price paths with /page or /sort segments to clean /shop/{slug}. */
export function shopPriceListingPathRedirect(pathname: string): string | null {
  const listing = parsePriceListingPath(pathname)
  if (!listing) return null
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean)
  const hasLegacyTail =
    segments.includes('page') ||
    segments.includes('sort') ||
    (segments.length >= 3 && segments[2] === 'sort')
  if (!hasLegacyTail) return null
  return buildPriceListingHref(listing.scope, listing.rangeId)
}

/** Redirect legacy /product/{slug} to /shop/{slug}. */
export function legacyProductPriceRedirect(pathname: string): string | null {
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean)
  if (segments[0] !== 'product' || !segments[1]) return null
  const parsed = parsePriceListingSlug(segments[1])
  if (!parsed) return null
  return buildPriceListingHref(parsed.scope, parsed.rangeId)
}

export function getScopeLabel(scope: PriceListingScope): string {
  return SCOPE_LABELS[scope] ?? scope
}

export function getPriceListingTitle(scope: PriceListingScope, range: PriceRangeBucket): string {
  const scopeLabel = getScopeLabel(scope)
  return `${scopeLabel} ${range.label}`
}

export function getPriceListingDescription(scope: PriceListingScope, range: PriceRangeBucket): string {
  const scopeLabel = getScopeLabel(scope).toLowerCase()
  if (range.id === 'above-50000') {
    return `Shop premium ${scopeLabel} above ₹50,000 at AMIORA. Live pricing on gold and diamond jewellery.`
  }
  if (range.id === 'under-1000') {
    return `Discover affordable ${scopeLabel} under ₹1,000 at AMIORA. Handcrafted pieces with transparent live pricing.`
  }
  return `Browse ${scopeLabel} from ${range.label} at AMIORA. Live gold and diamond prices, handcrafted in India.`
}

export function resolvePriceListingScopeFromShop(scopeSlug: string | null): PriceListingScope {
  if (!scopeSlug) return JEWELLERY_SCOPE
  if ((CATEGORY_SCOPES as readonly string[]).includes(scopeSlug)) {
    return scopeSlug as CategoryScope
  }
  return JEWELLERY_SCOPE
}

export function isPriceListingPath(pathname: string): boolean {
  return parsePriceListingPath(pathname) != null
}
