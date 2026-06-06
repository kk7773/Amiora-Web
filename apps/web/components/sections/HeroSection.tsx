'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { Button } from '@amiora/ui'

export function HeroSection() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      tl.fromTo(
        overlayRef.current,
        { opacity: 1 },
        { opacity: 0, duration: 1.2 }
      )
        .fromTo(
          headingRef.current,
          { y: 80, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2 },
          '-=0.6'
        )
        .fromTo(
          subRef.current,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          '-=0.6'
        )
        .fromTo(
          ctaRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          '-=0.4'
        )
    })

    return () => ctx.revert()
  }, [])

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-obsidian-900">
      {/* Background image placeholder */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.08)_0%,_transparent_70%)]" />

      {/* GSAP intro overlay */}
      <div ref={overlayRef} className="absolute inset-0 z-10 bg-obsidian-900" />

      <div className="section-padding relative z-20 flex flex-col items-center text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.4em] text-gold-500">
          Premium Jewellery
        </p>
        <h1
          ref={headingRef}
          className="font-display text-5xl font-light leading-tight text-ivory-100 md:text-7xl lg:text-8xl"
        >
          Timeless
          <br />
          <span className="gold-text">Elegance</span>
        </h1>
        <p ref={subRef} className="mt-6 max-w-lg text-base text-ivory-200/60 md:text-lg">
          Handcrafted gold, diamond and silver jewellery that celebrates every moment of your life.
        </p>
        <div ref={ctaRef} className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Button variant="gold" size="xl" asChild>
            <Link href="/products">Explore Collection</Link>
          </Button>
          <Button variant="premium" size="xl" asChild>
            <Link href="/collections">View Collections</Link>
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <div className="h-8 w-px bg-gold-500/40" />
        <p className="text-[10px] uppercase tracking-widest text-gold-500/60">Scroll</p>
      </div>
    </section>
  )
}
