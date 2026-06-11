'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronDown, MessageCircle } from 'lucide-react'
import { cn } from '@amiora/ui'
import { fadeUp, stagger } from '@/lib/animations'

interface FaqItem {
  id: string
  question: string
  answer: string
}

export function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<string | null>(faqs[0]?.id ?? null)

  if (!faqs.length) return null

  return (
    <motion.section
      className="section-y bg-cream border-t border-divider"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      <div className="section-x">
        <div className="grid gap-10 lg:gap-16 lg:grid-cols-[minmax(260px,340px)_1fr] items-start">
          <motion.div variants={fadeUp} className="lg:sticky lg:top-24 space-y-5">
            <div>
              <p className="text-2xs uppercase tracking-widest2 text-teal mb-3">Help</p>
              <h2 className="font-display text-display-2xl text-ink leading-tight">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-ink-muted mt-4 leading-relaxed max-w-sm">
                Quick answers about hallmarking, live pricing, custom orders, returns, and delivery
                across India.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-sm font-medium text-deep-teal hover:text-teal transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Still have questions? Contact us
            </Link>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-1">
            {faqs.map((faq, index) => {
              const isOpen = openIdx === faq.id
              return (
                <motion.div
                  key={faq.id}
                  variants={fadeUp}
                  className={cn(
                    'rounded-2xl border transition-colors duration-300 overflow-hidden',
                    isOpen
                      ? 'border-teal/40 bg-bg shadow-sm'
                      : 'border-divider bg-bg/80 hover:border-teal/25',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : faq.id)}
                    className="w-full flex items-start justify-between gap-4 px-5 sm:px-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-start gap-4 min-w-0">
                      <span className="font-display text-lg text-teal/70 tabular-nums shrink-0 w-6">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="font-medium text-base text-ink leading-snug pt-0.5">
                        {faq.question}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 text-ink-muted shrink-0 mt-0.5 transition-transform duration-300',
                        isOpen && 'rotate-180 text-teal',
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-all duration-300 ease-out',
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 sm:px-6 pb-5 sm:pb-6 pl-[4.25rem] text-sm text-ink-muted leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
