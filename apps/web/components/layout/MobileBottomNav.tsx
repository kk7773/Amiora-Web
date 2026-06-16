'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  ShoppingBag,
  Search,
  LayoutGrid,
  User,
  X,
  ShoppingCart,
  Loader2,
  Gem,
  Heart,
  Info,
  BookOpen,
  MapPin,
  Wand2,
  Phone,
  Shield,
  RotateCcw,
  ScrollText,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@amiora/ui'
import { useCartStore, useCartHydrated } from '@/stores/cartStore'
import { useSearchSuggest } from '@/hooks/useSearchSuggest'
import { SearchCombobox, useSearchKeyboardNav } from '@/components/search/SearchCombobox'
import type { SearchSuggestion } from '@/app/api/search/suggest/route'

export const MOBILE_NAV_HEIGHT = 62

type StoreLink = { label: string; href: string; icon: LucideIcon }

const STORE_GRID: StoreLink[] = [
  { label: 'Collections',    href: '/collections',        icon: Gem          },
  { label: 'Shop All',       href: '/shop',               icon: ShoppingBag  },
  { label: 'Rings',          href: '/shop/rings',         icon: Gem          },
  { label: 'Necklaces',      href: '/shop/necklaces',     icon: Gem          },
  { label: 'Earrings',       href: '/shop/earrings',      icon: Gem          },
  { label: 'Bangles',        href: '/shop/bangles',       icon: Gem          },
  { label: 'About Us',       href: '/about',              icon: Info         },
  { label: 'Blogs',          href: '/blogs',              icon: BookOpen     },
  { label: 'Our Stores',     href: '/stores',             icon: MapPin       },
  { label: 'Custom',         href: '/customization',      icon: Wand2        },
  { label: 'Contact',        href: '/contact',            icon: Phone        },
  { label: 'Wishlist',       href: '/account/wishlist',   icon: Heart        },
]

const POLICY_LINKS: StoreLink[] = [
  { label: 'Shipping', href: '/policies/shipping', icon: Shield      },
  { label: 'Returns',  href: '/policies/returns',  icon: RotateCcw   },
  { label: 'Terms',    href: '/policies/terms',    icon: ScrollText  },
  { label: 'Privacy',  href: '/policies/privacy',  icon: Lock        },
]

function TabItem({
  active,
  label,
  onClick,
  href,
  children,
}: {
  active: boolean
  label: string
  onClick?: () => void
  href?: string
  children: React.ReactNode
}) {
  const className = cn(
    'relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[48px] py-1.5',
    'text-cream transition-colors active:scale-95',
    active ? 'text-gold' : 'text-cream/80 hover:text-cream',
  )

  const content = (
    <>
      {active && (
        <span className="absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gold" />
      )}
      {children}
      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-pressed={active}>
      {content}
    </button>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const itemCount = useCartStore((s) => s.itemCount())
  const cartHydrated = useCartHydrated()
  const cartBadge = cartHydrated ? itemCount : 0

  const [storeOpen, setStoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [pending, startNav] = useTransition()
  const { suggestions, loading, show: suggestOpen } = useSearchSuggest(searchOpen ? searchQ : '')

  function navigateToSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    setSearchOpen(false)
    setSearchQ('')
    startNav(() => router.push(`/search?q=${encodeURIComponent(trimmed)}`))
  }

  function navigateToProduct(suggestion: SearchSuggestion) {
    setSearchOpen(false)
    setSearchQ('')
    startNav(() => router.push(suggestion.href))
  }

  const { activeIndex, setActiveIndex, handleKeyDown } = useSearchKeyboardNav(
    suggestions,
    suggestOpen && searchOpen,
    () => navigateToSearch(searchQ),
    navigateToProduct,
  )

  useEffect(() => {
    document.body.style.overflow = storeOpen || searchOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [storeOpen, searchOpen])

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 80)
  }, [searchOpen])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigateToSearch(searchQ)
  }

  const isShop =
    pathname === '/shop' ||
    pathname.startsWith('/shop/') ||
    pathname.startsWith('/collections')
  const isCart = pathname.startsWith('/cart')
  const isProfile = pathname.startsWith('/account')
  const isStore = storeOpen

  const navBottom = `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gold/20 bg-deep-teal shadow-[0_-4px_24px_rgba(26,20,16,0.2)] pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile navigation"
      >
        <div className="flex h-[62px]">
          <TabItem active={isShop} label="Shop" href="/shop">
            <ShoppingBag size={22} strokeWidth={isShop ? 2.25 : 2} />
          </TabItem>

          <TabItem
            active={searchOpen}
            label="Search"
            onClick={() => { setStoreOpen(false); setSearchOpen((v) => !v) }}
          >
            {pending ? <Loader2 size={22} className="animate-spin" /> : <Search size={22} strokeWidth={searchOpen ? 2.25 : 2} />}
          </TabItem>

          <TabItem
            active={isStore}
            label="Store"
            onClick={() => { setSearchOpen(false); setStoreOpen((v) => !v) }}
          >
            <LayoutGrid size={22} strokeWidth={isStore ? 2.25 : 2} />
          </TabItem>

          <TabItem active={isCart} label="Cart" href="/cart">
            <span className="relative inline-flex">
              <ShoppingCart size={22} strokeWidth={isCart ? 2.25 : 2} />
              {cartBadge > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-0.5 text-[9px] font-bold text-deep-teal">
                  {cartBadge > 9 ? '9+' : cartBadge}
                </span>
              )}
            </span>
          </TabItem>

          <TabItem active={isProfile} label="Profile" href="/account">
            <User size={22} strokeWidth={isProfile ? 2.25 : 2} />
          </TabItem>
        </div>
      </nav>

      {/* Search overlay */}
      {searchOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => { setSearchOpen(false); setSearchQ('') }}
            aria-hidden
          />
          <div
            className="md:hidden fixed left-0 right-0 z-50 px-4 pt-3 pb-4 bg-bg/95 backdrop-blur-md border-t border-divider shadow-lg"
            style={{ bottom: navBottom }}
          >
            <form onSubmit={handleSearch}>
              <SearchCombobox
                value={searchQ}
                onChange={setSearchQ}
                onSubmit={() => navigateToSearch(searchQ)}
                onSelect={navigateToProduct}
                onClose={() => { setSearchOpen(false); setSearchQ('') }}
                suggestions={suggestions}
                loading={loading}
                suggestOpen={suggestOpen}
                activeIndex={activeIndex}
                onActiveIndexChange={setActiveIndex}
                onKeyDown={handleKeyDown}
                inputRef={searchRef}
                variant="mobile"
                placeholder="Search rings, necklaces…"
                pending={pending}
              />
            </form>
          </div>
        </>
      )}

      {/* Store sheet backdrop */}
      <div
        onClick={() => setStoreOpen(false)}
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm transition-opacity duration-300',
          storeOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden={!storeOpen}
      />

      {/* Store bottom sheet */}
      <div
        className={cn(
          'md:hidden fixed left-0 right-0 z-40 max-h-[78vh] overflow-y-auto rounded-t-2xl bg-bg shadow-[0_-8px_40px_rgba(26,20,16,0.18)] transition-transform duration-300 ease-out',
          storeOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ bottom: navBottom }}
        role="dialog"
        aria-modal={storeOpen}
        aria-label="Browse store"
        aria-hidden={!storeOpen}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-divider" />
        </div>

        <div className="flex items-center justify-between border-b border-divider px-5 pb-3">
          <span className="font-display text-lg tracking-widest text-deep-teal">Browse</span>
          <button
            type="button"
            onClick={() => setStoreOpen(false)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-ink transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="mb-3 text-2xs uppercase tracking-widest2 text-ink-faint">Shop</p>
          <div className="grid grid-cols-2 gap-2.5">
            {STORE_GRID.map(({ label, href, icon: Icon }) => (
              <Link
                key={href + label}
                href={href}
                onClick={() => setStoreOpen(false)}
                className="flex flex-col items-center gap-2 rounded-xl bg-surface px-3 py-4 text-center transition-colors active:scale-[0.98] hover:bg-surface-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-deep-teal/10 text-deep-teal">
                  <Icon size={18} />
                </span>
                <span className="text-xs font-medium text-ink leading-tight">{label}</span>
              </Link>
            ))}
          </div>

          <p className="mb-3 mt-6 text-2xs uppercase tracking-widest2 text-ink-faint">Policies</p>
          <div className="grid grid-cols-2 gap-2.5 pb-4">
            {POLICY_LINKS.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setStoreOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm text-ink transition-colors active:scale-[0.98] hover:bg-surface-2"
              >
                <Icon size={16} className="shrink-0 text-deep-teal" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
