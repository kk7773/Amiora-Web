import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { shopListingPathRedirect } from '@/lib/shop/paths'
import {
  buildPriceListingHref,
  parsePriceListingSlug,
  shopPriceListingPathRedirect,
} from '@/lib/shop/priceListingSlugs'

const PROTECTED_PREFIXES = ['/account']
const AUTH_PREFIXES      = ['/login', '/register', '/forgot-password']

function withCanonicalPath(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers)
  const { pathname } = request.nextUrl
  const canonicalPath =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  requestHeaders.set('x-canonical-path', canonicalPath)
  return requestHeaders
}

function stripListingQuery(url: URL) {
  url.searchParams.delete('page')
  url.searchParams.delete('sort')
  return url
}

function shopUrlRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl

  const legacyShop =
    shopListingPathRedirect(pathname) ?? shopPriceListingPathRedirect(pathname)
  if (legacyShop) {
    const url = stripListingQuery(request.nextUrl.clone())
    url.pathname = legacyShop
    return NextResponse.redirect(url, 308)
  }

  if (pathname.startsWith('/collections/')) {
    const slug = pathname.split('/').filter(Boolean)[1]
    if (slug) {
      const url = stripListingQuery(request.nextUrl.clone())
      url.pathname = `/shop/${slug}`
      return NextResponse.redirect(url, 308)
    }
  }

  if (pathname.startsWith('/categories/')) {
    const slug = pathname.split('/').filter(Boolean)[1]
    if (slug) {
      const url = stripListingQuery(request.nextUrl.clone())
      url.pathname = `/shop/${slug}`
      return NextResponse.redirect(url, 308)
    }
  }

  if (pathname.startsWith('/product/')) {
    const slug = pathname.split('/').filter(Boolean)[1]
    const parsed = slug ? parsePriceListingSlug(slug) : null
    if (parsed) {
      const url = stripListingQuery(request.nextUrl.clone())
      url.pathname = buildPriceListingHref(parsed.scope, parsed.rangeId)
      return NextResponse.redirect(url, 308)
    }
  }

  if (
    (pathname === '/shop' || pathname.startsWith('/shop/')) &&
    (request.nextUrl.searchParams.has('page') || request.nextUrl.searchParams.has('sort'))
  ) {
    const url = stripListingQuery(request.nextUrl.clone())
    return NextResponse.redirect(url, 308)
  }

  return null
}

export async function middleware(request: NextRequest) {
  const shopRedirect = shopUrlRedirect(request)
  if (shopRedirect) return shopRedirect

  const requestHeaders = withCanonicalPath(request)
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const { pathname } = request.nextUrl
  const needsAuth =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    AUTH_PREFIXES.some((p) => pathname.startsWith(p))

  if (!needsAuth) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (user && AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/account'
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$|api/).*)',
  ],
}
