'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const DESKTOP_BANNER =
  'https://res.cloudinary.com/dqayol6fn/image/upload/v1780649163/Amiora_banner_1.jpg_bgjjsz.jpg'
const MOBILE_BANNER =
  'https://res.cloudinary.com/dqayol6fn/image/upload/v1780649207/Amiora_mobile_banner_1.jpg_vidlv1.jpg'

export function HeroBanner() {
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to('.hero-parallax-bg', {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={containerRef} className="relative h-[72dvh] min-h-[420px] md:h-[100dvh] md:min-h-[500px] lg:min-h-[600px] overflow-hidden">
      <div className="hero-parallax-bg absolute inset-0">
        <Image
          src={DESKTOP_BANNER}
          alt="Amiora Diamonds — Diamonds that feel uniquely yours"
          fill
          priority
          sizes="100vw"
          className="hidden md:block object-cover object-center"
        />
        <Image
          src={MOBILE_BANNER}
          alt="Amiora Diamonds — Diamonds that feel uniquely yours"
          fill
          priority
          sizes="100vw"
          className="md:hidden object-cover object-top"
        />
      </div>

      <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 opacity-50 pointer-events-none z-10">
        <div className="h-10 w-px bg-cream/50 animate-pulse" />
        <p className="text-2xs uppercase tracking-widest2 text-cream rotate-90 origin-center mt-4">Scroll</p>
      </div>
    </section>
  )
}
