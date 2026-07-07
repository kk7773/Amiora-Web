'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const DESKTOP_BANNER =
  'https://res.cloudinary.com/dqayol6fn/image/upload/f_auto,q_auto,w_1920/v1780649163/Amiora_banner_1.jpg_bgjjsz.jpg'
const MOBILE_BANNER =
  'https://res.cloudinary.com/dqayol6fn/image/upload/f_auto,q_auto,w_828/v1780649207/Amiora_mobile_banner_1.jpg_vidlv1.jpg'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

export function HeroBanner() {
  const containerRef = useRef<HTMLElement>(null)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    let ctx: { revert: () => void } | undefined

    void import('gsap').then(({ gsap }) => {
      void import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger)
        ctx = gsap.context(() => {
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
      })
    })

    return () => ctx?.revert()
  }, [])

  const showDesktop = isDesktop !== false
  const showMobile = isDesktop !== true
  const desktopPriority = isDesktop === true
  const mobilePriority = isDesktop === false || isDesktop === null

  return (
    <section ref={containerRef} className="relative h-[72dvh] min-h-[420px] md:h-screen md:min-h-screen overflow-hidden">
      <div className="hero-parallax-bg absolute inset-0">
        {showDesktop && (
          <Image
            src={DESKTOP_BANNER}
            alt="Amiora Diamonds — Diamonds that feel uniquely yours"
            fill
            priority={desktopPriority}
            sizes="100vw"
            className="object-cover object-center"
          />
        )}
        {showMobile && (
          <Image
            src={MOBILE_BANNER}
            alt="Amiora Diamonds — Diamonds that feel uniquely yours"
            fill
            priority={mobilePriority}
            sizes="100vw"
            className="object-cover object-top"
          />
        )}
      </div>

      <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 opacity-50 pointer-events-none z-10">
        <div className="h-10 w-px bg-cream/50 animate-pulse" />
        <p className="text-2xs uppercase tracking-widest2 text-cream rotate-90 origin-center mt-4">Scroll</p>
      </div>
    </section>
  )
}
