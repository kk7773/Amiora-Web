'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StarRating } from '@/components/ui/StarRating'
import { fadeUp } from '@/lib/animations'

interface TestimonialItem {
  id: string
  name: string
  location: string | null
  quote: string
  rating: number
}

interface TestimonialsProps {
  testimonials: TestimonialItem[]
}

export function Testimonials({ testimonials }: TestimonialsProps) {
  const [idx, setIdx]       = useState(0)
  const [dir, setDir]       = useState(1)
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = (next: number, direction: number) => {
    setDir(direction)
    setIdx((next + testimonials.length) % testimonials.length)
    resetTimer()
  }

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setDir(1)
      setIdx((i) => (i + 1) % testimonials.length)
    }, 4000)
  }

  useEffect(() => {
    if (!testimonials.length) return
    resetTimer()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [testimonials.length])

  if (!testimonials.length) return null
  const current = testimonials[idx]!

  return (
    <motion.section
      className="section-y bg-surface"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="section-x">
        <div className="text-center mb-12">
          <p className="text-2xs uppercase tracking-widest2 text-ink mb-3">Reviews</p>
          <h2 className="font-display text-display-2xl text-ink">What Our Customers Say</h2>
        </div>

        <div className="max-w-2xl mx-auto relative">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={idx}
              custom={dir}
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={  { opacity: 0, x: dir * -60 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-center px-12 sm:px-8"
            >
              <StarRating rating={current.rating} size="md" showCount={false} className="justify-center mb-6" />
              <blockquote className="font-display text-xl md:text-2xl text-ink leading-relaxed mb-6">
                &ldquo;{current.quote}&rdquo;
              </blockquote>
              <div>
                <p className="font-medium text-ink">{current.name}</p>
                {current.location && (
                  <p className="text-sm text-ink-muted">{current.location}</p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Arrows — pushed to edges, won't overlap text */}
          <button
            onClick={() => goTo(idx - 1, -1)}
            aria-label="Previous testimonial"
            className="absolute left-0 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 text-ink-muted hover:text-ink transition-colors"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={() => goTo(idx + 1, 1)}
            aria-label="Next testimonial"
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 text-ink-muted hover:text-ink transition-colors"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > idx ? 1 : -1)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx ? 'w-8 bg-ink' : 'w-2 bg-divider'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.section>
  )
}
