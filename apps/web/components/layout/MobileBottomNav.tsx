'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  ShoppingBag, Search, LayoutGrid, User, X, ChevronRight,
  ShoppingCart, Loader2,
} from 'lucide-react'
import { useCartStore, useCartHydrated } from '@/stores/cartStore'

const STORE_LINKS = [
  { label: 'All Collections',  href: '/collections' },
  { label: 'Shop All',         href: '/shop' },
  { label: 'Rings',            href: '/shop/rings' },
  { label: 'Necklaces',        href: '/shop/necklaces' },
  { label: 'Earrings',         href: '/shop/earrings' },
  { label: 'Bangles',          href: '/shop/bangles' },
  { label: 'About Us',         href: '/about' },
  { label: 'Blogs',            href: '/blogs' },
  { label: 'Our Stores',       href: '/stores' },
  { label: 'Custom Jewellery', href: '/customization' },
]

export function MobileBottomNav() {
  const pathname   = usePathname()
  const router     = useRouter()
  const itemCount  = useCartStore(s => s.itemCount())
  const cartHydrated = useCartHydrated()
  const cartBadge    = cartHydrated ? itemCount : 0

  const [storeOpen,  setStoreOpen]  = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ,    setSearchQ]    = useState('')
  const searchRef                   = useRef<HTMLInputElement>(null)
  const [pending,    startNav]      = useTransition()

  useEffect(() => {
    document.body.style.overflow = storeOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [storeOpen])

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 80)
  }, [searchOpen])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQ.trim()
    if (!q) return
    setSearchOpen(false)
    setSearchQ('')
    startNav(() => router.push(`/search?q=${encodeURIComponent(q)}`))
  }

  const isShop    = pathname === '/shop'
  const isCart    = pathname.startsWith('/cart')
  const isProfile = pathname.startsWith('/account')
  const isStore   = storeOpen

  return (
    <>
      {/* ── Bottom tab bar ─────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          backgroundColor: '#285260',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex', height: 62 }}>

          {/* Shop */}
          <Link
            href="/shop"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: isShop ? '#C9A84C' : '#E0D7CF', textDecoration: 'none' }}
          >
            <ShoppingBag size={22} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Shop</span>
          </Link>

          {/* Search */}
          <button
            onClick={() => { setStoreOpen(false); setSearchOpen(v => !v) }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: searchOpen ? '#C9A84C' : '#E0D7CF' }}
          >
            {pending ? <Loader2 size={22} className="animate-spin" /> : <Search size={22} />}
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Search</span>
          </button>

          {/* Store */}
          <button
            onClick={() => { setSearchOpen(false); setStoreOpen(v => !v) }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: isStore ? '#C9A84C' : '#E0D7CF' }}
          >
            <LayoutGrid size={22} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Store</span>
          </button>

          {/* Cart */}
          <Link
            href="/cart"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: isCart ? '#C9A84C' : '#E0D7CF', textDecoration: 'none', position: 'relative' }}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <ShoppingCart size={22} />
              {cartBadge > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: '#C9A84C', color: '#285260',
                  borderRadius: 9999, width: 16, height: 16,
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {cartBadge > 9 ? '9+' : cartBadge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cart</span>
          </Link>

          {/* Profile */}
          <Link
            href="/account"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: isProfile ? '#C9A84C' : '#E0D7CF', textDecoration: 'none' }}
          >
            <User size={22} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Profile</span>
          </Link>

        </div>
      </nav>

      {/* ── Search bar (above nav) ──────────────────────────────────────── */}
      {searchOpen && (
        <div
          className="md:hidden fixed left-0 right-0 z-50"
          style={{ bottom: 62, backgroundColor: '#285260', borderTop: '1px solid rgba(255,255,255,0.12)', padding: '10px 16px' }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={16} color="#E0D7CF" style={{ opacity: 0.6, flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="search"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search rings, necklaces, gold…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#E0D7CF' }}
            />
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQ('') }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#E0D7CF', opacity: 0.6, display: 'flex' }}
            >
              <X size={16} />
            </button>
          </form>
        </div>
      )}

      {/* ── Store bottom sheet ─────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setStoreOpen(false)}
        className="md:hidden fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(26,20,16,0.5)',
          opacity: storeOpen ? 1 : 0,
          pointerEvents: storeOpen ? 'auto' : 'none',
        }}
      />

      {/* Sheet panel */}
      <div
        className="md:hidden fixed left-0 right-0 z-40 rounded-t-2xl overflow-y-auto transition-transform duration-300"
        style={{
          bottom: 62,
          maxHeight: '75vh',
          backgroundColor: '#FAF8F5',
          transform: storeOpen ? 'translateY(0)' : 'translateY(100%)',
          boxShadow: '0 -8px 40px rgba(26,20,16,0.18)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: '#D8D2C9' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px', borderBottom: '1px solid #D8D2C9' }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: '#285260', letterSpacing: '0.15em' }}>Store</span>
          <button
            onClick={() => setStoreOpen(false)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: '#6B6560' }}
          >
            <X size={18} />
          </button>
        </div>

        <nav style={{ paddingBottom: 8 }}>
          {STORE_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setStoreOpen(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', fontSize: 14, color: '#1A1410', textDecoration: 'none' }}
            >
              {link.label}
              <ChevronRight size={16} color="#A8A29C" />
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
