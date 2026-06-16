'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ProductCard, type ProductCardProps } from '@/components/product/ProductCard'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'
import { fadeUp, stagger } from '@/lib/animations'

interface ProductGridSectionProps {
  heading:     string
  viewAllHref: string
  products:    ProductCardProps['product'][]
  loading?:    boolean
  columns?:    2 | 4 | 5
}

const GRID_CLASS: Record<2 | 4 | 5, string> = {
  2: 'grid-cols-2',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
}

const VISIBLE_COUNT: Record<2 | 4 | 5, number> = {
  2:  2,
  4:  4,
  5: 10,
}

const MOBILE_GRID_COUNT = 4
const MOBILE_RAIL_SKELETON_COUNT = 3

function productKey(product: ProductCardProps['product'], index: number) {
  return product.id ?? `${product.slug ?? 'product'}-${index}`
}

export function ProductGridSection({
  heading,
  viewAllHref,
  products,
  loading = false,
  columns = 4,
}: ProductGridSectionProps) {
  const gridClass = GRID_CLASS[columns]
  const desktopCount = VISIBLE_COUNT[columns]
  const allProducts = (products ?? []).slice(0, desktopCount)
  const mobileGridProducts = allProducts.slice(0, MOBILE_GRID_COUNT)
  const mobileRailProducts = allProducts.slice(MOBILE_GRID_COUNT)
  const cardClassName = columns === 5 ? 'text-sm' : ''
  const hasMobileOverflow = mobileRailProducts.length > 0

  return (
    <motion.section
      className="section-x section-y"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8 md:mb-10">
        <div>
          <p className="text-2xs uppercase tracking-widest2 text-ink mb-2">Curated</p>
          <h2 className="font-display text-display-2xl text-ink">{heading}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="text-sm text-ink hover:text-ink-muted transition-colors underline-offset-4 hover:underline shrink-0"
        >
          View All →
        </Link>
      </motion.div>

      {/* Mobile — 2×2 grid + horizontal overflow rail */}
      <div className="md:hidden space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: MOBILE_GRID_COUNT }).map((_, i) => (
                <motion.div key={`mobile-grid-skel-${i}`} variants={fadeUp}>
                  <ProductCardSkeleton />
                </motion.div>
              ))
            : mobileGridProducts.map((product, index) => (
                <motion.div key={productKey(product, index)} variants={fadeUp}>
                  <ProductCard product={product} className={cardClassName} />
                </motion.div>
              ))}
        </div>

        {(loading || hasMobileOverflow) && (
          <>
            {!loading && hasMobileOverflow && (
              <p className="text-2xs uppercase tracking-widest2 text-ink-faint">
                Swipe for more →
              </p>
            )}
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-1">
              {loading
                ? Array.from({ length: MOBILE_RAIL_SKELETON_COUNT }).map((_, i) => (
                    <motion.div
                      key={`mobile-rail-skel-${i}`}
                      variants={fadeUp}
                      className="shrink-0 w-[44vw] max-w-[180px] snap-start"
                    >
                      <ProductCardSkeleton />
                    </motion.div>
                  ))
                : mobileRailProducts.map((product, index) => (
                    <motion.div
                      key={productKey(product, MOBILE_GRID_COUNT + index)}
                      variants={fadeUp}
                      className="shrink-0 w-[44vw] max-w-[180px] snap-start"
                    >
                      <ProductCard product={product} className={cardClassName} />
                    </motion.div>
                  ))}
            </div>
          </>
        )}
      </div>

      {/* Desktop — full grid unchanged */}
      <div className={`hidden md:grid gap-5 ${gridClass}`}>
        {loading
          ? Array.from({ length: desktopCount }).map((_, i) => (
              <motion.div key={`desktop-skel-${i}`} variants={fadeUp}>
                <ProductCardSkeleton />
              </motion.div>
            ))
          : allProducts.map((product, index) => (
              <motion.div key={productKey(product, index)} variants={fadeUp}>
                <ProductCard product={product} className={cardClassName} />
              </motion.div>
            ))}
      </div>

      {/* View All Products — desktop only; mobile uses header link */}
      <motion.div variants={fadeUp} className="mt-8 md:mt-12 hidden md:flex justify-center">
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-2.5 px-8 py-3.5 border border-deep-teal text-deep-teal text-sm uppercase tracking-widest font-medium rounded-full hover:bg-deep-teal hover:text-cream transition-all duration-300 group"
        >
          View All Products
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </motion.section>
  )
}
