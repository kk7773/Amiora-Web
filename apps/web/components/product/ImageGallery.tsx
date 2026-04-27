'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ZoomIn } from 'lucide-react'
import { cn } from '@amiora/ui'

interface GalleryImage {
  id: string
  url: string
  alt_text: string | null
  sort_order: number
  variant_id: string | null
}

interface ImageGalleryProps {
  images:                 GalleryImage[]
  productName:            string
  activeVariantId?:       string | null
  /** Effective % off vs undiscounted total (making + stone discounts); show badge when ≥ 1 */
  discountPercentOff?:   number | null
}

export function ImageGallery({ images, productName, activeVariantId, discountPercentOff }: ImageGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [lightbox,  setLightbox]  = useState(false)

  // Show variant-specific images if variant selected, fallback to product images
  const visible = activeVariantId
    ? images.filter((i) => !i.variant_id || i.variant_id === activeVariantId)
    : images

  const sorted = [...visible].sort((a, b) => a.sort_order - b.sort_order)
  const current = sorted[activeIdx] ?? sorted[0]

  return (
    <>
      <div className="flex gap-4">
        {/* Thumbnail strip */}
        {sorted.length > 1 && (
          <div className="hidden md:flex flex-col gap-2 w-16 shrink-0">
            {sorted.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveIdx(i)}
                className={cn(
                  'relative aspect-square rounded-md overflow-hidden border-2 transition-all',
                  i === activeIdx ? 'border-teal' : 'border-transparent hover:border-divider'
                )}
              >
                <Image src={img.url} alt={img.alt_text ?? productName} fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div className="flex-1">
          <div
            className="relative aspect-square rounded-2xl overflow-hidden bg-surface cursor-zoom-in group"
            onClick={() => setLightbox(true)}
          >
            {current && (
              <Image
                src={current.url}
                alt={current.alt_text ?? productName}
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            )}
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2 pointer-events-none">
              {typeof discountPercentOff === 'number' && discountPercentOff >= 1 && (
                <span className="inline-block bg-deep-teal text-cream text-2xs sm:text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums shadow-sm">
                  {discountPercentOff}% off
                </span>
              )}
              <div className="pointer-events-auto p-2 bg-bg/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="h-4 w-4 text-ink" />
              </div>
            </div>
          </div>

          {/* Mobile thumbnail strip */}
          {sorted.length > 1 && (
            <div className="md:hidden flex gap-2 mt-3 overflow-x-auto pb-1">
              {sorted.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    'relative shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all',
                    i === activeIdx ? 'border-teal' : 'border-transparent'
                  )}
                >
                  <Image src={img.url} alt="" fill className="object-cover" sizes="56px" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && current && (
        <div
          className="fixed inset-0 z-50 bg-ink/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-cream hover:text-white transition-colors"
            onClick={() => setLightbox(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative max-w-4xl w-full max-h-[90vh] aspect-square">
            <Image src={current.url} alt={current.alt_text ?? productName} fill className="object-contain" sizes="90vw" />
          </div>
        </div>
      )}
    </>
  )
}
