import type { Metadata } from 'next'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export const metadata: Metadata = {
  title: 'About Amiora',
  description: 'The story behind Amiora Diamonds — craftsmanship, values, and heritage.',
}

const VALUES = [
  { title: 'Authenticity',   desc: 'Every piece is BIS Hallmarked. Every diamond, independently certified. Zero compromise.' },
  { title: 'Craftsmanship',  desc: 'Master artisans with 3+ generations of expertise craft each piece by hand.' },
  { title: 'Transparency',   desc: 'Live pricing, open sourcing, full traceability — you always know what you pay for.' },
  { title: 'Sustainability',  desc: 'Ethically sourced metals, conflict-free diamonds, eco-conscious packaging.' },
]

const AWARDS = [
  'India Jewellery Excellence Award — 2023',
  'BIS Certified Manufacturer',
  'GIA Partner Member',
  'ISO 9001:2015 Certified',
]

export default function AboutPage() {
  return (
    <>
      <StaticPageSchema
        title="About AMIORA"
        description="The story behind Amiora Diamonds — craftsmanship, values, and heritage."
        path="/about"
      />
    <div>
      {/* Hero */}
      <div className="relative h-[60vh] min-h-[400px] overflow-hidden bg-surface">
        <Image
          src="https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1600&q=80"
          alt="Amiora craftsmanship"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-deep-teal/70 to-transparent" />
        <div className="absolute inset-0 section-x flex items-center">
          <div className="max-w-xl space-y-4">
            <p className="text-2xs uppercase tracking-widest2 text-light-teal">Our Story</p>
            <h1 className="font-display text-display-2xl text-white">Jewellery as an Art Form</h1>
            <p className="text-base text-cream/80 leading-relaxed">Founded in 1998 in Jaipur, AMIORA has grown from a single workshop into India&apos;s most trusted fine jewellery brand — without ever compromising on craft.</p>
          </div>
        </div>
      </div>

      {/* Values */}
      <section className="section-x section-y">
        <div className="text-center mb-12">
          <p className="text-2xs uppercase tracking-widest2 text-teal mb-3">What We Stand For</p>
          <h2 className="font-display text-display-2xl text-ink">Our Values</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="bg-surface rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-lg text-deep-teal">{v.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story section */}
      <section className="bg-surface section-x section-y">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <p className="text-2xs uppercase tracking-widest2 text-teal">Our Heritage</p>
            <h2 className="font-display text-display-xl text-ink">Three Generations of Craft</h2>
            <p className="text-base text-ink-muted leading-relaxed">
              AMIORA was born from a simple belief: that beautiful jewellery should be honest.
              From our grandfather&apos;s workshop in Johari Bazaar to our modern studios in Delhi, Mumbai
              and Jaipur, the ethos remains the same — let the metal and the stone speak.
            </p>
            <p className="text-base text-ink-muted leading-relaxed">
              Today we serve over 50,000 customers across India, with live gold and diamond pricing
              that ensures every purchase is fair and transparent.
            </p>
          </div>
          <div className="relative aspect-square rounded-2xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800&q=80"
              alt="Craftsmanship"
              fill
              className="object-cover"
              sizes="50vw"
            />
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="section-x section-y text-center">
        <p className="text-2xs uppercase tracking-widest2 text-teal mb-3">Recognition</p>
        <h2 className="font-display text-display-xl text-ink mb-10">Awards & Certifications</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {AWARDS.map((a) => (
            <div key={a} className="px-6 py-3 border border-divider rounded-full text-sm text-ink-muted hover:border-teal hover:text-teal transition-colors">
              {a}
            </div>
          ))}
        </div>
      </section>
    </div>
    </>
  )
}
