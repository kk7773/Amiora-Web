'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { stagger, fadeUp } from '@/lib/animations'

interface CityGroup {
  city:       string
  count:      number
  image_url:  string | null
}

export function StoreCitiesSection({ cities }: { cities: CityGroup[] }) {
  if (!cities.length) return null

  return (
    <motion.section
      className="section-x section-y"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="mb-10">
        <p className="text-2xs uppercase tracking-widest2 text-ink mb-2">Our Presence</p>
        <h2 className="font-display text-display-2xl text-ink">Locate Us Near You</h2>
      </motion.div>

      {/* City cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {cities.map((c) => (
          <motion.div key={c.city} variants={fadeUp}>
            <Link
              href={`/stores?city=${encodeURIComponent(c.city)}`}
              className="group block rounded-2xl overflow-hidden bg-surface hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-white/30 to-cream">
                {c.image_url ? (
                  <Image
                    src={c.image_url}
                    alt={`AMIORA store in ${c.city}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MapPin className="h-10 w-10 text-ink/30" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-display text-base text-ink group-hover:text-ink-muted transition-colors">
                    {c.city}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {c.count} {c.count === 1 ? 'store' : 'stores'}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-ink">
                  <MapPin className="h-4 w-4" />
                </div>
              </div>

              {/* View Stores link */}
              <div className="px-4 pb-4">
                <span className="text-xs text-ink group-hover:text-ink-muted transition-colors underline-offset-2 group-hover:underline">
                  View Stores →
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}
