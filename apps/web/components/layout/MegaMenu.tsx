'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { resolveCollectionImageUrl } from '@/lib/shop/collectionFallbackImages'

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

function collectionPreviewUrl(col: MenuCollection) {
  return resolveCollectionImageUrl(col.thumb_url, col.slug, col.name)
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
        const first = d.collections?.[0]
        setActiveImage(first ? collectionPreviewUrl(first) : null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="absolute left-0 right-0 top-full bg-bg border-b border-divider shadow-lg animate-fade-in z-50">
      <div className="section-x py-8 mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_min(280px,32%)] md:gap-10 lg:gap-12">

        {/* Left — collections + products (equal-width columns, aligned tops) */}
        <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-8 md:grid-cols-4 md:gap-x-6 lg:gap-x-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex min-w-0 flex-col space-y-3">
                  <div className="skeleton h-5 w-28 rounded" />
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="skeleton h-4 w-full max-w-[11rem] rounded" />
                  ))}
                </div>
              ))
            : collections.map((col) => (
                <div
                  key={col.slug}
                  className="flex min-w-0 flex-col items-stretch"
                  onMouseEnter={() => setActiveImage(collectionPreviewUrl(col))}
                >
                  <Link
                    href={`/shop/${col.slug}`}
                    onClick={onClose}
                    className="font-display text-xl text-deep-teal hover:text-teal transition-colors mb-3 block leading-tight"
                  >
                    {col.name}
                  </Link>
                  <ul className="m-0 list-none p-0 flex flex-col gap-0.5">
                    {col.products.slice(0, 5).map((p) => (
                      <li key={p.slug} className="min-w-0">
                        <Link
                          href={`/shop/${col.slug}/${p.slug}`}
                          onClick={onClose}
                          className="group flex items-start gap-2 py-2 text-base leading-snug text-ink-muted hover:text-teal transition-colors"
                        >
                          {/* Name first so left edge aligns with collection title above */}
                          <span className="min-w-0 flex-1">{p.name}</span>
                          <ChevronRight
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                          />
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
            href="/collections"
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
