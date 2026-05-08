'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ShoppingBag, Search, Heart, Menu, X } from 'lucide-react'
import { Button } from '@amiora/ui'
import { useCartStore, useCartHydrated } from '@/stores/cartStore'
import { MobileMenu } from './MobileMenu'
import { cn } from '@amiora/ui'

const NAV_LINKS = [
  { label: 'Collections', href: '/shop/collections' },
  { label: 'Rings', href: '/products?category=rings' },
  { label: 'Necklaces', href: '/products?category=necklaces' },
  { label: 'Earrings', href: '/products?category=earrings' },
  { label: 'Bracelets', href: '/products?category=bracelets' },
]

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const totalItems = useCartStore((s) => s.itemCount())
  const cartHydrated = useCartHydrated()
  const cartBadge = cartHydrated ? totalItems : 0

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          'fixed top-0 z-40 w-full transition-all duration-500',
          isScrolled
            ? 'bg-background/95 backdrop-blur-md shadow-sm border-b border-border'
            : 'bg-transparent'
        )}
      >
        <div className="section-padding flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="https://res.cloudinary.com/dqayol6fn/image/upload/v1778155061/Amiora-final-logo-02_jicz5d.png"
              alt="Amiora"
              width={148}
              height={36}
              className="h-auto w-auto max-h-10"
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm tracking-wide text-foreground/80 transition-colors hover:text-gold-500"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/search">
                <Search className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/account/wishlist">
                <Heart className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link href="/cart">
                <ShoppingBag className="h-5 w-5" />
                {cartBadge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-obsidian-900">
                    {cartBadge > 9 ? '9+' : cartBadge}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />
    </>
  )
}
