'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/animations'
import { getCollectionHref } from '@/lib/shop/paths'
import { resolveCollectionImageUrl } from '@/lib/shop/collectionFallbackImages'

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
        <motion.div variants={fadeUp} className="mb-8 md:mb-12 text-center">
          <p className="text-2xs uppercase tracking-widest2 text-ink mb-3">Explore</p>
          <h2 className="font-display text-display-2xl text-ink">Our Collections</h2>
        </motion.div>

        {/* Grid — horizontal snap on mobile, grid on md+ */}
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar md:overflow-visible pb-1 md:pb-0">
          {collections.map((col) => {
            const imageUrl = resolveCollectionImageUrl(col.banner_url, col.slug, col.name)
            return (
            <motion.div key={col.slug} variants={fadeUp} className="shrink-0 w-[72vw] max-w-[280px] snap-start md:w-auto md:max-w-none">
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
