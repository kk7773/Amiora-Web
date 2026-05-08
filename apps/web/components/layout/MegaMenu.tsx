'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'

interface MenuCollection {
  id: string
  name: string
  slug: string
  thumb_url: string | null
  products: { name: string; slug: string }[]
}

interface MegaMenuProps {
  onClose: () => void
}

export function MegaMenu({ onClose }: MegaMenuProps) {
  const [collections, setCollections] = useState<MenuCollection[]>([])
  const [activeImage,  setActiveImage]  = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    fetch('/api/menu/collections')
      .then((r) => r.json())
      .then((d: { collections: MenuCollection[] }) => {
        setCollections(d.collections ?? [])
        setActiveImage(d.collections?.[0]?.thumb_url ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="absolute left-0 right-0 top-full bg-bg border-b border-divider shadow-lg animate-fade-in z-50">
      <div className="section-x py-8 grid grid-cols-[1fr_280px] gap-12 max-w-6xl mx-auto">

        {/* Left — collections + products */}
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="skeleton h-4 w-24 rounded" />
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="skeleton h-3 w-32 rounded" />
                  ))}
                </div>
              ))
            : collections.map((col) => (
                <div
                  key={col.slug}
                  onMouseEnter={() => setActiveImage(col.thumb_url)}
                >
                  <Link
                    href={`/shop/${col.slug}`}
                    onClick={onClose}
                    className="font-display text-lg text-deep-teal hover:text-teal transition-colors block mb-2"
                  >
                    {col.name}
                  </Link>
                  <ul className="space-y-1">
                    {col.products.slice(0, 5).map((p) => (
                      <li key={p.slug}>
                        <Link
                          href={`/shop/${col.slug}/${p.slug}`}
                          onClick={onClose}
                          className="text-xs text-ink-muted hover:text-teal transition-colors flex items-center gap-1 group"
                        >
                          <ChevronRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
        </div>

        {/* Right — featured image */}
        <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface">
          {activeImage ? (
            <Image
              src={activeImage}
              alt="Collection preview"
              fill
              className="object-cover transition-opacity duration-300"
              sizes="280px"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-light-teal/30 to-cream flex items-end p-4">
              <p className="font-display text-xl text-deep-teal">Explore All</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-deep-teal/40 to-transparent" />
          <Link
            href="/shop/collections"
            onClick={onClose}
            className="absolute bottom-4 left-4 text-xs uppercase tracking-widest text-white hover:text-cream transition-colors"
          >
            View All Collections →
          </Link>
        </div>
      </div>
    </div>
  )
}
