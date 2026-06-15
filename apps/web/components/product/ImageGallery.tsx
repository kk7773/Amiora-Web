'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Film, X, ZoomIn } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@amiora/ui'
import { useInlineImageZoom } from '@/hooks/useInlineImageZoom'

interface GalleryImage {
  id: string
  url: string
  media_type?: 'image' | 'video'
  alt_text: string | null
  sort_order: number
  variant_id: string | null
}

function isVideoItem(item: GalleryImage) {
  return item.media_type === 'video'
}

function GalleryThumb({ item, productName }: { item: GalleryImage; productName: string }) {
  if (isVideoItem(item)) {
    return (
      <>
        <video src={item.url} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" />
        <span className="absolute inset-0 flex items-center justify-center bg-ink/25">
          <Film className="h-4 w-4 text-white drop-shadow" aria-hidden />
        </span>
      </>
    )
  }
  return (
    <Image
      src={item.url}
      alt={item.alt_text ?? productName}
      fill
      className="object-cover"
      sizes="64px"
    />
  )
}

function GallerySlide({
  item,
  productName,
  priority,
  className,
  style,
}: {
  item: GalleryImage
  productName: string
  priority?: boolean
  className?: string
  style?: CSSProperties
}) {
  if (isVideoItem(item)) {
    return (
      <video
        src={item.url}
        controls
        playsInline
        className={cn('h-full w-full object-contain', className)}
        style={style}
      />
    )
  }
  return (
    <Image
      src={item.url}
      alt={item.alt_text ?? productName}
      fill
      priority={priority}
      className={cn('object-contain select-none', className)}
      sizes="(max-width: 768px) 100vw, 50vw"
      draggable={false}
      style={style}
    />
  )
}

interface ImageGalleryProps {
  images: GalleryImage[]
  productName: string
  activeVariantId?: string | null
  discountPercentOff?: number | null
}

export function ImageGallery({
  images,
  productName,
  activeVariantId,
  discountPercentOff,
}: ImageGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const zoomContainerRef = useRef<HTMLDivElement>(null)

  const visible = activeVariantId
    ? images.filter((i) => !i.variant_id || i.variant_id === activeVariantId)
    : images

  const sorted = [...visible].sort((a, b) => a.sort_order - b.sort_order)
  const current = sorted[activeIdx] ?? sorted[0]
  const currentIsVideo = current ? isVideoItem(current) : false
  const imageIdsKey = useMemo(() => sorted.map((i) => i.id).join(','), [sorted])

  const { imageStyle, zoomActive, isPanning, resetZoom, containerProps } =
    useInlineImageZoom(zoomContainerRef)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    setActiveIdx(0)
  }, [imageIdsKey])

  const closeViewer = useCallback(() => {
    resetZoom()
    setViewerOpen(false)
  }, [resetZoom])

  const openViewer = useCallback(() => {
    resetZoom()
    setViewerOpen(true)
  }, [resetZoom])

  const goToImage = useCallback(
    (idx: number) => {
      resetZoom()
      setActiveIdx(idx)
    },
    [resetZoom],
  )

  useEffect(() => {
    if (!viewerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer()
      if (e.key === 'ArrowLeft' && sorted.length > 1) {
        goToImage((activeIdx - 1 + sorted.length) % sorted.length)
      }
      if (e.key === 'ArrowRight' && sorted.length > 1) {
        goToImage((activeIdx + 1) % sorted.length)
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [viewerOpen, closeViewer, goToImage, activeIdx, sorted.length])

  useEffect(() => {
    if (viewerOpen) resetZoom()
  }, [current?.id, viewerOpen, resetZoom])

  const thumbClass = (active: boolean) =>
    cn(
      'relative overflow-hidden border-2 transition-all duration-200',
      active
        ? 'border-teal ring-2 ring-teal/40'
        : 'border-transparent hover:border-divider',
    )

  const viewerModal = (
    <AnimatePresence>
      {viewerOpen && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 isolate"
          role="dialog"
          aria-modal="true"
          aria-label="Product image viewer"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/80 backdrop-blur-md"
            aria-label="Close viewer"
            onClick={closeViewer}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative z-10 flex flex-col w-full max-w-5xl max-h-[92dvh] rounded-2xl bg-bg border border-divider shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-divider bg-surface shrink-0">
              <p className="text-sm text-ink truncate">{productName}</p>
              {sorted.length > 1 && (
                <p className="text-2xs text-ink-faint tabular-nums shrink-0 hidden sm:block">
                  {activeIdx + 1} / {sorted.length}
                </p>
              )}
              <button
                type="button"
                onClick={closeViewer}
                className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-bg transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-4 flex-1 min-h-0">
              {sorted.length > 1 && (
                <button
                  type="button"
                  onClick={() => goToImage((activeIdx - 1 + sorted.length) % sorted.length)}
                  className="shrink-0 p-2.5 rounded-full bg-surface border border-divider text-ink-muted hover:text-ink hover:border-teal transition-colors shadow-sm"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              <div
                ref={currentIsVideo ? undefined : zoomContainerRef}
                {...(currentIsVideo ? {} : containerProps)}
                className={cn(
                  'relative flex-1 min-w-0 mx-auto aspect-square max-h-[min(62dvh,560px)] w-full rounded-xl overflow-hidden bg-surface',
                  'ring-1 ring-divider',
                  currentIsVideo
                    ? ''
                    : zoomActive
                      ? isPanning
                        ? 'cursor-grabbing'
                        : 'cursor-grab'
                      : 'cursor-zoom-in',
                )}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0"
                    style={currentIsVideo ? undefined : imageStyle}
                  >
                    <GallerySlide item={current} productName={productName} />
                  </motion.div>
                </AnimatePresence>

                {!currentIsVideo && !zoomActive && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg/90 backdrop-blur-sm text-ink-faint shadow-sm">
                    <ZoomIn className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="text-2xs tracking-wide">Tap to zoom</span>
                  </div>
                )}
              </div>

              {sorted.length > 1 && (
                <button
                  type="button"
                  onClick={() => goToImage((activeIdx + 1) % sorted.length)}
                  className="shrink-0 p-2.5 rounded-full bg-surface border border-divider text-ink-muted hover:text-ink hover:border-teal transition-colors shadow-sm"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            {sorted.length > 1 && (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5 border-t border-divider/60 pt-3 shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-center">
                  {sorted.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => goToImage(i)}
                      aria-label={`View image ${i + 1}`}
                      aria-current={i === activeIdx ? 'true' : undefined}
                      className={cn(
                        thumbClass(i === activeIdx),
                        'shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-md',
                      )}
                    >
                      <GalleryThumb item={img} productName={productName} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <div className="flex gap-4">
        {sorted.length > 1 && (
          <div className="hidden md:flex flex-col gap-2 w-16 shrink-0">
            {sorted.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => goToImage(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === activeIdx ? 'true' : undefined}
                className={cn(thumbClass(i === activeIdx), 'aspect-square rounded-md')}
              >
                <GalleryThumb item={img} productName={productName} />
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {currentIsVideo ? (
            <div
              className={cn(
                'relative aspect-square w-full rounded-2xl overflow-hidden bg-surface',
                'ring-1 ring-divider shadow-[inset_0_2px_12px_rgba(26,20,16,0.04)]',
              )}
            >
              <AnimatePresence mode="wait">
                {current && (
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <GallerySlide item={current} productName={productName} priority />
                  </motion.div>
                )}
              </AnimatePresence>
              {typeof discountPercentOff === 'number' && discountPercentOff >= 1 && (
                <div className="absolute top-3 right-3 z-10 pointer-events-none">
                  <span className="inline-block bg-deep-teal text-cream text-2xs sm:text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums shadow-sm">
                    {discountPercentOff}% off
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openViewer}
              aria-label="Open image viewer"
              className={cn(
                'relative aspect-square w-full rounded-2xl overflow-hidden bg-surface text-left',
                'ring-1 ring-divider shadow-[inset_0_2px_12px_rgba(26,20,16,0.04)]',
                'cursor-zoom-in group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal',
              )}
            >
              <AnimatePresence mode="wait">
                {current && (
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <GallerySlide
                      item={current}
                      productName={productName}
                      priority
                      className="transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2 pointer-events-none">
                {typeof discountPercentOff === 'number' && discountPercentOff >= 1 && (
                  <span className="inline-block bg-deep-teal text-cream text-2xs sm:text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums shadow-sm">
                    {discountPercentOff}% off
                  </span>
                )}
              </div>

              <div className="absolute bottom-3 right-3 z-10 pointer-events-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-bg/80 backdrop-blur-sm text-ink-faint">
                <ZoomIn className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-2xs tracking-wide">Tap to view</span>
              </div>
            </button>
          )}

          {sorted.length > 1 && (
            <div className="md:hidden flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
              {sorted.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => goToImage(i)}
                  aria-label={`View image ${i + 1}`}
                  aria-current={i === activeIdx ? 'true' : undefined}
                  className={cn(thumbClass(i === activeIdx), 'shrink-0 w-14 h-14 rounded-md')}
                >
                  <GalleryThumb item={img} productName={productName} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {portalReady && createPortal(viewerModal, document.body)}
    </>
  )
}
