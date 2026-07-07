'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/animations'

const MATERIALS = [
  {
    key:   'gold',
    emoji: '✦',
    title: 'Gold Jewellery',
    sub:   '22K · 18K · 14K · 9K',
    body:  'From timeless yellow gold to romantic rose gold and modern white gold — every variant BIS hallmarked and certified.',
    href:  '/shop/gold',
    accent:'text-gold',
  },
  {
    key:   'diamond',
    emoji: '💎',
    title: 'Diamond Jewellery',
    sub:   'Certified · Multiple Cuts',
    body:  'Round Brilliant, Princess, Emerald, Oval and more. Every diamond independently certified with full traceability.',
    href:  '/shop/diamond',
    accent:'text-ink',
  },
]

export function MaterialShowcase() {
  return (
    <motion.section
      className="section-y bg-surface"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      <div className="section-x">
        <motion.div variants={fadeUp} className="text-center mb-12">
          <p className="text-2xs uppercase tracking-widest2 text-ink mb-3">Our Materials</p>
          <h2 className="font-display text-display-2xl text-ink">Crafted from the Finest</h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {MATERIALS.map((mat) => (
            <motion.div
              key={mat.key}
              variants={fadeUp}
              className="group rounded-[28px] border border-black/8 bg-white/90 p-8 md:p-10 flex flex-col gap-5 min-h-[320px] shadow-[0_20px_60px_rgba(30,24,20,0.06)] transition-transform duration-300 hover:-translate-y-1"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border border-black/8 bg-surface-2 text-3xl"
                aria-hidden
              >
                <span className={mat.accent}>{mat.emoji}</span>
              </div>
              <div>
                <h3 className="font-display text-xl text-ink">{mat.title}</h3>
                <p className={`text-xs uppercase tracking-widest mt-1 ${mat.accent}`}>{mat.sub}</p>
              </div>
              <p className="text-base text-ink-muted leading-relaxed max-w-[34ch]">{mat.body}</p>
              <Link
                href={mat.href}
                className="mt-auto inline-flex w-fit items-center text-sm font-medium text-ink transition-colors group-hover:text-ink-muted"
              >
                Shop {mat.title.split(' ')[0]} →
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
