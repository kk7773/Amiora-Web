'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Search, User, Heart, ShoppingBag, Menu, X, Loader2, LogOut, Package, UserCircle, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCartStore, useCartHydrated } from '@/stores/cartStore'
import { MegaMenu } from './MegaMenu'
import { MobileMenu } from './MobileMenu'
import { createBrowserClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const NAV_LINKS = [
  { label: 'Collections', href: '/collections', hasMega: true },
  { label: 'Shop',        href: '/shop',        hasMega: false },
  { label: 'About',       href: '/about',       hasMega: false },
  { label: 'Blogs',       href: '/blogs',       hasMega: false },
]

export function Header() {
  const [scrolled,     setScrolled]     = useState(false)
  const [megaOpen,     setMegaOpen]     = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [user,         setUser]         = useState<SupabaseUser | null>(null)
  const megaLeaveTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef                  = useRef<HTMLInputElement>(null)
  const itemCount                       = useCartStore((s) => s.itemCount())
  const cartHydrated                    = useCartHydrated()
  const cartBadge                       = cartHydrated ? itemCount : 0
  const router                          = useRouter()
  const [pending, startSearch]          = useTransition()

  // Live auth state
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-focus input when search bar opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80)
    }
  }, [searchOpen])

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleMegaEnter = () => {
    if (megaLeaveTimer.current) clearTimeout(megaLeaveTimer.current)
    setMegaOpen(true)
  }
  const handleMegaLeave = () => {
    megaLeaveTimer.current = setTimeout(() => setMegaOpen(false), 150)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchInputRef.current?.value.trim() ?? ''
    if (!q) return
    setSearchOpen(false)
    startSearch(() => {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    })
  }

  return (
    <>
      {/* Top announcement bar */}
      <div className="bg-deep-teal text-cream text-2xs tracking-widest2 text-center py-2 px-4 hidden sm:block">
        Free shipping on orders ₹5,000+&nbsp;&nbsp;·&nbsp;&nbsp;BIS Hallmarked&nbsp;&nbsp;·&nbsp;&nbsp;
        Call: +91-98765-43210
      </div>

      <header className="sticky top-0 z-40 w-full">

        {/* ── MOBILE header ── deep-teal bg, hamburger left, logo centered ── */}
        <div className="md:hidden flex h-14 items-center px-4 bg-deep-teal">
          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }}
          >
            <Menu size={22} color="#C9A84C" />
          </button>

          {/* Logo — centered */}
          <Link
            href="/"
            aria-label="Amiora home"
            style={{ flex: 1, display: 'flex', justifyContent: 'center', textDecoration: 'none' }}
          >
            <Image
              src="https://res.cloudinary.com/dqayol6fn/image/upload/v1778259827/Amiora-final-logo-01_mu4i6k.png"
              alt="Amiora"
              width={120}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>

          {/* Right placeholder — keeps logo visually centered */}
          <div style={{ width: 38 }} />
        </div>

        {/* ── DESKTOP header ── light bg, logo left, nav center, actions right ── */}
        <div
          className={`hidden md:block transition-all duration-300 ${
            scrolled
              ? 'bg-bg/95 backdrop-blur-md shadow-sm border-b border-divider'
              : 'bg-bg'
          }`}
        >
          <div className="section-x flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="shrink-0" aria-label="Amiora Diamonds home">
              <Image
                src="https://res.cloudinary.com/dqayol6fn/image/upload/v1778155061/Amiora-final-logo-02_jicz5d.png"
                alt="Amiora"
                width={120}
                height={28}
                className="h-7 w-auto"
                priority
              />
            </Link>

            {/* Desktop nav */}
            <nav className="flex items-center gap-8">
              {NAV_LINKS.map((link) =>
                link.hasMega ? (
                  <div
                    key={link.href}
                    onMouseEnter={handleMegaEnter}
                    onMouseLeave={handleMegaLeave}
                    className="relative"
                  >
                    <button className="text-sm tracking-wide text-ink-muted hover:text-deep-teal transition-colors duration-200 py-2">
                      {link.label}
                    </button>
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm tracking-wide text-ink-muted hover:text-deep-teal transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>

            {/* Desktop right actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                aria-label={searchOpen ? 'Close search' : 'Search'}
                className="relative p-2 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
              >
                {pending
                  ? <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  : searchOpen
                    ? <X className="h-[18px] w-[18px]" />
                    : <Search className="h-[18px] w-[18px]" />}
              </button>
              <IconBtn href="/account/wishlist" label="Wishlist">
                <Heart className="h-[18px] w-[18px]" />
              </IconBtn>
              <IconBtn href="/cart" label="Cart" badge={cartBadge}>
                <ShoppingBag className="h-[18px] w-[18px]" />
              </IconBtn>
              <UserMenu user={user} />
            </div>
          </div>
        </div>

        {/* Inline search bar — slides down below header */}
        <div
          className={`overflow-hidden transition-all duration-300 border-b border-divider ${
            searchOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <form onSubmit={handleSearchSubmit} className="section-x flex items-center gap-3 py-3">
            <Search className="h-4 w-4 text-ink-faint shrink-0" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search jewellery — rings, necklaces, gold, silver…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
            />
            <button
              type="submit"
              className="shrink-0 text-xs font-medium text-deep-teal hover:text-teal transition-colors"
            >
              Search →
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="shrink-0 text-ink-faint hover:text-ink transition-colors"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Mega-menu */}
        {megaOpen && (
          <div onMouseEnter={handleMegaEnter} onMouseLeave={handleMegaLeave}>
            <MegaMenu onClose={() => setMegaOpen(false)} />
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}

/* ── User Menu ───────────────────────────────────────────────────────────── */
function UserMenu({ user }: { user: SupabaseUser | null }) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const ref                   = useRef<HTMLDivElement>(null)
  const router                = useRouter()

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    setLoading(true)
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    setOpen(false)
    setLoading(false)
    window.location.href = '/'
  }

  // Not logged in — show sign in link
  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="Sign In"
        className="relative p-2 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
      >
        <User className="h-[18px] w-[18px]" />
      </Link>
    )
  }

  // Logged in — show avatar with dropdown
  const name  = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? ''
  const email = user.email ?? ''
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Account menu"
        className="flex items-center gap-1 p-1 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
      >
        <span className="h-7 w-7 rounded-full bg-deep-teal text-cream text-[11px] font-semibold flex items-center justify-center shrink-0">
          {initials || <User className="h-3.5 w-3.5" />}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl shadow-black/10 border border-divider py-1.5 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-divider">
            <p className="text-sm font-medium text-ink truncate">{name || 'My Account'}</p>
            <p className="text-xs text-ink-faint truncate mt-0.5">{email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <DropdownLink href="/account" icon={<UserCircle className="h-3.5 w-3.5" />} onClick={() => setOpen(false)}>
              My Profile
            </DropdownLink>
            <DropdownLink href="/account/orders" icon={<Package className="h-3.5 w-3.5" />} onClick={() => setOpen(false)}>
              My Orders
            </DropdownLink>
            <DropdownLink href="/account/wishlist" icon={<Heart className="h-3.5 w-3.5" />} onClick={() => setOpen(false)}>
              Wishlist
            </DropdownLink>
          </div>

          <div className="border-t border-divider pt-1 pb-1">
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <LogOut className="h-3.5 w-3.5" />}
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownLink({ href, icon, children, onClick }: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-surface hover:text-deep-teal transition-colors"
    >
      <span className="text-ink-faint">{icon}</span>
      {children}
    </Link>
  )
}

/* ── Icon button helper ──────────────────────────────────────────────────── */
function IconBtn({
  href, label, badge, children,
}: {
  href: string
  label: string
  badge?: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative p-2 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal text-[9px] font-semibold text-white leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}


