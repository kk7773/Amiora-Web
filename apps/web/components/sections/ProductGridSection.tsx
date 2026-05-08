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

export function ProductGridSection({
  heading,
  viewAllHref,
  products,
  loading = false,
  columns = 4,
}: ProductGridSectionProps) {
  const gridClass = GRID_CLASS[columns]
  const visibleCount = VISIBLE_COUNT[columns]
  const visibleProducts = (products ?? []).slice(0, visibleCount)
  const skeletonCount = loading ? visibleCount : 0

  return (
    <motion.section
      className="section-x section-y"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10">
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

      {/* Grid */}
      <div className={`grid gap-5 ${gridClass}`}>
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <motion.div key={i} variants={fadeUp}>
                <ProductCardSkeleton />
              </motion.div>
            ))
          : visibleProducts.map((product, index) => (
              <motion.div key={product.id ?? `${product.slug ?? 'product'}-${index}`} variants={fadeUp}>
                <ProductCard
                  product={product}
                  className={columns === 5 ? 'text-sm' : ''}
                />
              </motion.div>
            ))}
      </div>

      {/* View All Products — bottom CTA */}
      <motion.div variants={fadeUp} className="mt-12 flex justify-center">
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
