'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@amiora/ui'
import { fadeUp, stagger } from '@/lib/animations'

interface FaqItem {
  id:       string
  question: string
  answer:   string
}

export function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<string | null>(null)

  if (!faqs.length) return null

  return (
    <motion.section
      className="section-x section-y bg-cream"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      <motion.div variants={fadeUp} className="text-center mb-10">
        <p className="text-2xs uppercase tracking-widest2 text-ink mb-2">Help</p>
        <h2 className="font-display text-display-2xl text-ink">Frequently Asked Questions</h2>
      </motion.div>

      <div className="max-w-2xl mx-auto space-y-2">
        {faqs.map((faq) => (
          <motion.div
            key={faq.id}
            variants={fadeUp}
            className="border border-divider rounded-xl bg-bg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === faq.id ? null : faq.id)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface/60 transition-colors"
            >
              <span className="font-medium text-sm text-ink">{faq.question}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-ink shrink-0 transition-transform duration-300',
                  openIdx === faq.id && 'rotate-180'
                )}
              />
            </button>
            <div
              className={cn(
                'overflow-hidden transition-all duration-300',
                openIdx === faq.id ? 'max-h-96' : 'max-h-0'
              )}
            >
              <p className="px-5 pb-5 text-sm text-ink-muted leading-relaxed">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}
