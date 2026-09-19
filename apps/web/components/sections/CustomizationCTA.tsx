'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeUp, slideInLeft, slideInRight } from '@/lib/animations'

export function CustomizationCTA() {
  return (
    <section className="bg-deep-teal overflow-hidden">
      <div className="section-x py-20 grid md:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <motion.div
          variants={slideInLeft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-6"
        >
          <p className="text-2xs uppercase tracking-widest2 text-light-teal">Bespoke Jewellery</p>
          <h2 className="font-display text-display-2xl text-white leading-tight">
            Design Your<br />Dream Piece
          </h2>
          <p className="text-base text-cream/70 leading-relaxed max-w-sm">
            Work directly with our master craftsmen to create a one-of-a-kind piece that tells
            your unique story. From concept to creation in 3–4 weeks.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/customization"
              className="inline-flex items-center gap-2 bg-gold text-ink px-8 py-3.5 text-sm font-semibold uppercase tracking-widest rounded-md hover:bg-gold-light transition-colors"
            >
              Start Customizing
            </Link>
            <Link
              href="/stores"
              className="inline-flex items-center gap-2 border border-cream/40 text-cream px-8 py-3.5 text-sm font-medium uppercase tracking-widest rounded-md hover:border-cream hover:bg-cream/10 transition-colors"
            >
              Visit a Store
            </Link>
          </div>
        </motion.div>

        {/* Image */}
        <motion.div
          variants={slideInRight}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative aspect-[4/3] rounded-2xl overflow-hidden"
        >
          <Image
            src="Dresign_you_dream_peice.avif"
            alt="Custom jewellery crafting"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-deep-teal/40 to-transparent" />
        </motion.div>
      </div>
    </section>
  )
}
