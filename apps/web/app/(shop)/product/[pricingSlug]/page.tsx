import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PriceListingPage } from '@/components/shop/PriceListingPage'
import {
  getPriceListingDescription,
  getPriceListingTitle,
  parsePriceListingPath,
  parsePriceListingSlug,
  PRODUCT_PRICE_BASE,
} from '@/lib/shop/priceListingSlugs'
import { parsePriceRangeParam } from '@/lib/shop/priceRanges'
import { canonicalFromPath } from '@/lib/seo/site'

interface Props {
  params: Promise<{ pricingSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pricingSlug } = await params
  const parsed = parsePriceListingSlug(pricingSlug)
  if (!parsed) return {}

  const range = parsePriceRangeParam(parsed.rangeId)
  if (!range) return {}

  const title = getPriceListingTitle(parsed.scope, range)
  const description = getPriceListingDescription(parsed.scope, range)

  return {
    title: `${title} | AMIORA`,
    description,
    alternates: {
      canonical: canonicalFromPath(`${PRODUCT_PRICE_BASE}/${pricingSlug}`),
    },
  }
}

export default async function ProductPricingSlugPage({ params }: Props) {
  const { pricingSlug } = await params
  const listing = parsePriceListingPath(`${PRODUCT_PRICE_BASE}/${pricingSlug}`)
  if (!listing) notFound()

  return <PriceListingPage listing={listing} />
}
