import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isListedSuperAdminEmail } from '@/lib/cmsSuperAdmins'

const PUBLIC_PATHS = ['/login', '/auth', '/api/admin-login', '/_next', '/favicon']

const HARDCODED_COOKIE_NAME  = 'amiora_admin_session'
const HARDCODED_COOKIE_VALUE = 'amiora-admin-authenticated-2024'

// Map route prefix → tab slug (must match ALL_NAV_ITEMS slugs in Sidebar)
const ROUTE_TO_TAB: Record<string, string> = {
  '/dashboard':        'dashboard',
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
}

function getTabSlug(pathname: string): string | null {
  for (const [prefix, slug] of Object.entries(ROUTE_TO_TAB)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return slug
  }
  return null
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
    const res      = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookies) =>
            cookies.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            ),
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Env allowlist: full access without user_metadata
    if (isListedSuperAdminEmail(user.email)) {
      return res
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
        return NextResponse.redirect(new URL('/login', req.url))
      }
      if (prof.role === 'super_admin') {
        return res
      }
      if (prof.role !== 'admin') {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login', req.url))
      }
      if (!tabSlug || pathname.startsWith('/api/')) {
        return res
      }
      const { data: can, error: rpcErr } = await supabase.rpc('cms_user_has_tab', { p_slug: tabSlug })
      if (!rpcErr && can === true) {
        return res
      }
      if (!rpcErr && can === false) {
        const url = new URL('/dashboard', req.url)
        url.searchParams.set('blocked', tabSlug)
        return NextResponse.redirect(url)
      }
      // RPC missing / error — fall through to legacy tab check below
      const { data: leg } = await supabase
        .from('cms_admin_permissions')
        .select('tab_slug')
        .eq('user_id', user.id)
        .eq('tab_slug', tabSlug)
        .maybeSingle()
      if (leg) return res
      const block = new URL('/dashboard', req.url)
      block.searchParams.set('blocked', tabSlug)
      return NextResponse.redirect(block)
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
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (effectiveRole === 'super_admin') {
      return res
    }

    if (!tabSlug || pathname.startsWith('/api/')) {
      return res
    }

    if (tabSlug === 'admin-management') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
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
      return NextResponse.redirect(url)
    }

    return res
  } catch {
    // Supabase not configured
  }

  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
