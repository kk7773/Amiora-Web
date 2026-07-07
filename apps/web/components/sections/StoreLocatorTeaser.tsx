'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { fadeUp } from '@/lib/animations'
import { AMIORA_STORE } from '@/lib/storefrontStore'

export function StoreLocatorTeaser({ storeCount = 1, cities = [AMIORA_STORE.city] }: { storeCount?: number; cities?: string[] }) {
  return (
    <motion.section
      className="bg-cream"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="section-x py-12 flex flex-col sm:flex-row items-center gap-6 justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-ink/10 rounded-full">
            <MapPin className="h-6 w-6 text-ink" />
          </div>
          <div>
            <h3 className="font-display text-xl text-ink">Visit Us In Store</h3>
            <p className="text-sm text-ink-muted">Experience jewellery in person</p>
          </div>
          {/* <span className="hidden sm:block bg-ink text-white text-xs px-3 py-1 rounded-full">
            {storeCount} Stores
          </span> */}
        </div>

        <div className="flex flex-wrap gap-2">
          {cities.map((city) => (
            <span
              key={city}
              className="px-4 py-1.5 rounded-full border border-sand/40 text-sm text-sand hover:border-sand hover:bg-sand/10 transition-colors cursor-default"
            >
              {city}
            </span>
          ))}
        </div>

        <Link
          href="/stores"
          className="shrink-0 bg-ink text-white px-6 py-3 text-sm font-medium uppercase tracking-widest rounded-md hover:bg-ink-muted transition-colors"
        >
          Find Nearest Store
        </Link>
      </div>
    </motion.section>
  )
}
