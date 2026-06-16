'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Search, User, Heart, ShoppingBag, X, Loader2, LogOut, Package, UserCircle, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCartStore, useCartHydrated } from '@/stores/cartStore'
import { MegaMenu } from './MegaMenu'
import { createBrowserClient } from '@/lib/supabase/client'
import { useSearchSuggest } from '@/hooks/useSearchSuggest'
import { SearchCombobox, useSearchKeyboardNav } from '@/components/search/SearchCombobox'
import type { SearchSuggestion } from '@/app/api/search/suggest/route'
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
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [user,         setUser]         = useState<SupabaseUser | null>(null)
  const megaLeaveTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef                  = useRef<HTMLInputElement>(null)
  const itemCount                       = useCartStore((s) => s.itemCount())
  const cartHydrated                    = useCartHydrated()
  const cartBadge                       = cartHydrated ? itemCount : 0
  const router                          = useRouter()
  const [pending, startSearch]          = useTransition()
  const { suggestions, loading, show: suggestOpen } = useSearchSuggest(searchOpen ? searchQuery : '')

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
    } else {
      setSearchQuery('')
    }
  }, [searchOpen])

  function navigateToSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    setSearchOpen(false)
    setSearchQuery('')
    startSearch(() => {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    })
  }

  function navigateToProduct(suggestion: SearchSuggestion) {
    setSearchOpen(false)
    setSearchQuery('')
    startSearch(() => {
      router.push(suggestion.href)
    })
  }

  const { activeIndex, setActiveIndex, handleKeyDown } = useSearchKeyboardNav(
    suggestions,
    suggestOpen && searchOpen,
    () => navigateToSearch(searchQuery),
    navigateToProduct,
  )

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
    navigateToSearch(searchQuery)
  }

  return (
    <>
      {/* Top announcement bar */}
      <div className="bg-deep-teal text-cream text-2xs tracking-widest2 text-center py-2 px-4 hidden sm:block">
        Free shipping on orders ₹5,000+&nbsp;&nbsp;·&nbsp;&nbsp;BIS Hallmarked&nbsp;&nbsp;·&nbsp;&nbsp;
        Call: +91-98765-43210
      </div>

      <header className="sticky top-0 z-40 w-full">

        {/* ── MOBILE header ── slim bar, logo centered, wishlist right ── */}
        <div className="md:hidden flex h-12 items-center px-3 bg-deep-teal">
          <div className="w-10 shrink-0" aria-hidden />

          <Link
            href="/"
            aria-label="Amiora home"
            className="flex flex-1 justify-center"
          >
            <Image
              src="https://res.cloudinary.com/dqayol6fn/image/upload/v1778259827/Amiora-final-logo-01_mu4i6k.png"
              alt="Amiora"
              width={120}
              height={40}
              className="h-7 w-auto"
              priority
            />
          </Link>

          <Link
            href={user ? '/account/wishlist' : '/login?redirect=%2Faccount%2Fwishlist'}
            aria-label="Wishlist"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gold transition-colors active:scale-95 hover:text-gold-light"
          >
            <Heart className="h-5 w-5" />
          </Link>
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
                src="https://res.cloudinary.com/dqayol6fn/image/upload/v1778259827/Amiora-final-logo-01_mu4i6k.png"
                alt="Amiora"
                width={150}
                height={35}
                className="h-10 w-auto max-h-10"
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
                    <button
                      type="button"
                      className="text-lg font-medium tracking-wide text-ink-muted hover:text-deep-teal transition-colors duration-200 py-0.5"
                    >
                      {link.label}
                    </button>
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-lg font-medium tracking-wide text-ink-muted hover:text-deep-teal transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>

            {/* Desktop right actions */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label={searchOpen ? 'Close search' : 'Search'}
                className="relative p-1.5 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
              >
                {pending
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : searchOpen
                    ? <X className="h-6 w-6" />
                    : <Search className="h-6 w-6" />}
              </button>
              <IconBtn href="/account/wishlist" label="Wishlist">
                <Heart className="h-6 w-6" />
              </IconBtn>
              <IconBtn href="/cart" label="Cart" badge={cartBadge}>
                <ShoppingBag className="h-6 w-6" />
              </IconBtn>
              <UserMenu user={user} />
            </div>
          </div>
        </div>

        {/* Inline search bar — slides down below header */}
        <div
          className={`transition-all duration-300 border-b border-divider ${
            searchOpen ? 'py-4 opacity-100' : 'max-h-0 py-0 opacity-0 pointer-events-none overflow-hidden'
          }`}
        >
          <form onSubmit={handleSearchSubmit} className="section-x">
            <SearchCombobox
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={() => navigateToSearch(searchQuery)}
              onSelect={navigateToProduct}
              onClose={() => setSearchOpen(false)}
              suggestions={suggestions}
              loading={loading}
              suggestOpen={suggestOpen}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onKeyDown={handleKeyDown}
              inputRef={searchInputRef}
              variant="header"
              placeholder="Search rings, necklaces, gold…"
              pending={pending}
            />
          </form>
        </div>

        {/* Mega-menu */}
        {megaOpen && (
          <div onMouseEnter={handleMegaEnter} onMouseLeave={handleMegaLeave}>
            <MegaMenu onClose={() => setMegaOpen(false)} />
          </div>
        )}
      </header>

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
        className="relative p-1.5 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
      >
        <User className="h-6 w-6" />
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
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Account menu"
        className="flex items-center gap-1 p-1 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
      >
        <span className="h-8 w-8 rounded-full bg-deep-teal text-cream text-xs font-semibold flex items-center justify-center shrink-0">
          {initials || <User className="h-4 w-4" />}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
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
      className="relative p-1.5 rounded-md text-ink-muted hover:text-deep-teal hover:bg-surface transition-colors"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] px-0.5 items-center justify-center rounded-full bg-teal text-[10px] font-semibold text-white leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}


