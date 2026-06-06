import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PriceListingPage } from '@/components/shop/PriceListingPage'
import {
  getPriceListingDescription,
  getPriceListingTitle,
  parsePriceListingPath,
  PRODUCT_PRICE_BASE,
} from '@/lib/shop/priceListingSlugs'
import { parsePriceRangeParam } from '@/lib/shop/priceRanges'
import { canonicalFromPath } from '@/lib/seo/site'

interface Props {
  params: Promise<{ pricingSlug: string; extra: string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pricingSlug, extra } = await params
  const listing = parsePriceListingPath(`${PRODUCT_PRICE_BASE}/${pricingSlug}/${extra.join('/')}`)
  if (!listing) return {}

  const range = parsePriceRangeParam(listing.rangeId)
  if (!range) return {}

  const title = getPriceListingTitle(listing.scope, range)
  const description = getPriceListingDescription(listing.scope, range)

  return {
    title: `${title} | AMIORA`,
    description,
    alternates: {
      canonical: canonicalFromPath(`${PRODUCT_PRICE_BASE}/${pricingSlug}/${extra.join('/')}`),
    },
  }
}

export default async function ProductPricingSlugExtraPage({ params }: Props) {
  const { pricingSlug, extra } = await params
  const listing = parsePriceListingPath(`${PRODUCT_PRICE_BASE}/${pricingSlug}/${extra.join('/')}`)
  if (!listing) notFound()

  return <PriceListingPage listing={listing} />
}
