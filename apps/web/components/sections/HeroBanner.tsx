'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ChevronRight, Volume2, VolumeX } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const VIDEO_URL = 'https://res.cloudinary.com/dqayol6fn/video/upload/v1776773155/header_swajkh.mp4'

export function HeroBanner() {
  const containerRef = useRef<HTMLElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  // GSAP entrance animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.3 })
      tl.fromTo('.hero-eyebrow', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' })
        .fromTo('.hero-heading',  { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 }, '-=0.4')
        .fromTo('.hero-sub',      { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.5')
        .fromTo('.hero-cta',      { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1 }, '-=0.4')
    }, containerRef)
    return () => ctx.revert()
  }, [])

  // Parallax scroll on video wrapper
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to('.hero-parallax-video', {
        yPercent: 12,
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

  function toggleMute() {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setMuted(videoRef.current.muted)
  }

  return (
    <section ref={containerRef} className="relative h-[100dvh] min-h-[500px] sm:min-h-[600px] overflow-hidden">

      {/* ── Background video ── */}
      <div className="hero-parallax-video absolute inset-0 scale-110">
        <video
          ref={videoRef}
          src={VIDEO_URL}
          autoPlay
          loop
          muted          /* starts muted for autoplay; user can unmute via button */
          playsInline    /* required for iOS inline playback */
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-deep-teal/65 via-deep-teal/30 to-transparent" />
      </div>

      {/* ── Overlay content ── */}
      <div className="relative z-10 h-full flex items-center">
        <div className="section-x w-full max-w-3xl">
          <p className="hero-eyebrow opacity-0 text-2xs tracking-widest2 text-light-teal uppercase mb-6">
            NEW COLLECTION 2025
          </p>
          <h1 className="space-y-1">
            <span
              className="hero-heading opacity-0 block font-display leading-none text-white"
              style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 1.05 }}
            >
              Crafted for
            </span>
            <span
              className="hero-heading opacity-0 block font-display leading-none text-gold"
              style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 1.05 }}
            >
              Every Moment
            </span>
          </h1>
          <p className="hero-sub opacity-0 mt-6 text-base text-cream/80 max-w-md leading-relaxed">
            Handcrafted gold &amp; diamond jewellery for life&apos;s most precious occasions.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/shop/collections"
              className="hero-cta opacity-0 inline-flex items-center gap-2 bg-white text-ink px-8 py-3.5 text-sm font-medium uppercase tracking-widest rounded-md hover:bg-surface transition-colors"
            >
              Explore Collections <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/customization"
              className="hero-cta opacity-0 inline-flex items-center gap-2 border border-white/50 text-white px-8 py-3.5 text-sm font-medium uppercase tracking-widest rounded-md hover:border-white hover:bg-white/10 transition-colors"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* ── Mute / Unmute toggle ── */}
      <button
        onClick={toggleMute}
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        className="absolute bottom-6 right-4 sm:bottom-8 sm:right-8 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60 transition-all text-xs uppercase tracking-widest pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
      >
        {muted
          ? <><VolumeX className="h-4 w-4" /><span>Unmute</span></>
          : <><Volume2 className="h-4 w-4" /><span>Mute</span></>
        }
      </button>

      {/* ── Scroll cue — hidden on short viewports to avoid overlap with mute btn ── */}
      <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 opacity-50 pointer-events-none">
        <div className="h-10 w-px bg-cream/50 animate-pulse" />
        <p className="text-2xs uppercase tracking-widest2 text-cream rotate-90 origin-center mt-4">Scroll</p>
      </div>

    </section>
  )
}
