import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isListedSuperAdminEmail } from '@/lib/cmsSuperAdmins'

const PUBLIC_PATHS = ['/login', '/auth', '/api/admin-login', '/_next', '/favicon']

const HARDCODED_COOKIE_NAME  = 'amiora_admin_session'
const HARDCODED_COOKIE_VALUE = 'amiora-admin-authenticated-2024'

// Map route prefix → tab slug (must match ALL_NAV_ITEMS slugs in Sidebar)
const ROUTE_TO_TAB: Record<string, string> = {
  // /dashboard is intentionally omitted — it is always accessible to any authenticated admin
  '/products':         'products',
  '/collections':      'collections',
  '/orders':           'orders',
  '/customers':        'customers',
  '/requests':         'requests',
  '/reviews':          'reviews',
  '/blogs':            'blogs',
  '/testimonials':     'testimonials',
  '/stores':           'stores',
  '/coupons':          'coupons',
  '/faqs':             'faqs',
  '/pricing':          'pricing',
  '/settings':         'settings',
  '/admin-management': 'admin-management',
  '/audit-logs':       'audit-logs',
}

function getTabSlug(pathname: string): string | null {
  for (const [prefix, slug] of Object.entries(ROUTE_TO_TAB)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return slug
  }
  return null
}

/** After getUser() refresh, Set-Cookie must be on the same response we return — redirects are new objects. */
function redirectPreservingSupabaseSession(url: URL, sessionResponse: NextResponse): NextResponse {
  const redir = NextResponse.redirect(url)
  for (const c of sessionResponse.cookies.getAll()) {
    redir.cookies.set(c.name, c.value)
  }
  const cacheControl = sessionResponse.headers.get('cache-control')
  if (cacheControl) redir.headers.set('cache-control', cacheControl)
  return redir
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ── Check 1: Hardcoded super-admin cookie — full access, no tab restrictions ──
  const adminCookie = req.cookies.get(HARDCODED_COOKIE_NAME)
  if (adminCookie?.value === HARDCODED_COOKIE_VALUE) {
    return NextResponse.next()
  }

  // ── Check 2: Supabase Auth session ─────────────────────────────────────────
  try {
    let supabaseResponse = NextResponse.next()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll(cookiesToSet, responseHeaders) {
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options)
            })
            if (responseHeaders) {
              Object.entries(responseHeaders).forEach(([key, value]) => {
                supabaseResponse.headers.set(key, String(value))
              })
            }
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return redirectPreservingSupabaseSession(new URL('/login', req.url), supabaseResponse)
    }

    // Env allowlist: full access without user_metadata
    if (isListedSuperAdminEmail(user.email)) {
      return supabaseResponse
    }

    const tabSlug = getTabSlug(pathname)

    // ── New RBAC: public.profiles + cms_user_has_tab() ────────────────────
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()

    const hasProfile = !profErr && prof != null

    if (hasProfile && prof) {
      if (!prof.is_active) {
        await supabase.auth.signOut()
        return redirectPreservingSupabaseSession(new URL('/login', req.url), supabaseResponse)
      }
      if (prof.role === 'super_admin') {
        return supabaseResponse
      }
      if (prof.role !== 'admin') {
        await supabase.auth.signOut()
        return redirectPreservingSupabaseSession(new URL('/login', req.url), supabaseResponse)
      }
      if (!tabSlug || pathname.startsWith('/api/')) {
        return supabaseResponse
      }
      const { data: can, error: rpcErr } = await supabase.rpc('cms_user_has_tab', { p_slug: tabSlug })
      if (!rpcErr && can === true) {
        return supabaseResponse
      }
      if (!rpcErr && can === false) {
        const superAdminOnlySlug = tabSlug === 'admin-management' || tabSlug === 'audit-logs'
        if (!superAdminOnlySlug) {
          const { count, error: permCountErr } = await supabase
            .from('admin_tab_permissions')
            .select('id', { count: 'exact', head: true })
            .eq('admin_id', user.id)
          if (!permCountErr && (count ?? 0) === 0) {
            return supabaseResponse
          }
        }
        const url = new URL('/dashboard', req.url)
        url.searchParams.set('blocked', tabSlug)
        return redirectPreservingSupabaseSession(url, supabaseResponse)
      }
      const { data: leg } = await supabase
        .from('cms_admin_permissions')
        .select('tab_slug')
        .eq('user_id', user.id)
        .eq('tab_slug', tabSlug)
        .maybeSingle()
      if (leg) return supabaseResponse
      const block = new URL('/dashboard', req.url)
      block.searchParams.set('blocked', tabSlug)
      return redirectPreservingSupabaseSession(block, supabaseResponse)
    }

    // ── Legacy: user_metadata + cms_admin_permissions ─────────────────────
    const rawCmsRole  = user.user_metadata?.cms_role ?? ''
    const legacyRole  = user.user_metadata?.role ?? ''
    const effectiveRole =
      rawCmsRole === 'super_admin' ? 'super_admin'
      : rawCmsRole === 'admin'    ? 'admin'
      : legacyRole === 'admin'    ? 'admin'
      : ''

    if (!effectiveRole) {
      await supabase.auth.signOut()
      return redirectPreservingSupabaseSession(new URL('/login', req.url), supabaseResponse)
    }

    if (effectiveRole === 'super_admin') {
      return supabaseResponse
    }

    if (!tabSlug || pathname.startsWith('/api/')) {
      return supabaseResponse
    }

    if (tabSlug === 'admin-management' || tabSlug === 'audit-logs') {
      return redirectPreservingSupabaseSession(new URL('/dashboard', req.url), supabaseResponse)
    }

    const { data: perm } = await supabase
      .from('cms_admin_permissions')
      .select('tab_slug')
      .eq('user_id', user.id)
      .eq('tab_slug', tabSlug)
      .maybeSingle()

    if (!perm) {
      const url = new URL('/dashboard', req.url)
      url.searchParams.set('blocked', tabSlug)
      return redirectPreservingSupabaseSession(url, supabaseResponse)
    }

    return supabaseResponse
  } catch {
    // Supabase not configured
  }

  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  // bulk-import has its own superadmin guard; skip middleware to avoid 10MB body buffer truncation
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/products/bulk-import).*)'],
}
