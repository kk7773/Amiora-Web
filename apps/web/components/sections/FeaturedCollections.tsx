'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/animations'
import { getCollectionHref } from '@/lib/shop/paths'

interface CollectionCard {
  id: string
  name: string
  slug: string
  banner_url: string | null
  description: string | null
}

interface FeaturedCollectionsProps {
  collections: CollectionCard[]
}

const COLLECTION_FALLBACK_IMAGES: Record<string, string> = {
  bridal: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=80',
  everyday: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80',
  'office-wear': 'https://images.unsplash.com/photo-1627293509201-cd0a9fce9fca?auto=format&fit=crop&w=1200&q=80',
  'gift-sets': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
}

function normKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function FeaturedCollections({ collections }: FeaturedCollectionsProps) {
  return (
    <section className="section-x section-y">
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        {/* Heading */}
        <motion.div variants={fadeUp} className="mb-12 text-center">
          <p className="text-2xs uppercase tracking-widest2 text-ink mb-3">Explore</p>
          <h2 className="font-display text-display-2xl text-ink">Our Collections</h2>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {collections.map((col) => {
            const slugKey = normKey(col.slug)
            const nameKey = normKey(col.name)
            const imageUrl =
              col.banner_url ||
              COLLECTION_FALLBACK_IMAGES[slugKey] ||
              COLLECTION_FALLBACK_IMAGES[nameKey] ||
              (nameKey.includes('office') ? COLLECTION_FALLBACK_IMAGES['office-wear'] : null)
            return (
            <motion.div key={col.slug} variants={fadeUp}>
              <Link
                href={getCollectionHref(col.slug)}
                className="group relative block aspect-[3/4] rounded-lg overflow-hidden bg-surface"
              >
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={col.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="h-full bg-gradient-to-br from-light-teal/30 to-cream" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-deep-teal/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <h3 className="font-display text-xl text-white leading-tight">{col.name}</h3>
                  {col.description && (
                    <p className="mt-1 text-xs text-cream/70 line-clamp-2">{col.description}</p>
                  )}
                </div>
              </Link>
            </motion.div>
          )})}
        </div>
      </motion.div>
    </section>
  )
}
