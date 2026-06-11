import { notFound, redirect } from 'next/navigation'
import {
  buildPriceListingHref,
  legacyProductPriceRedirect,
  parsePriceListingSlug,
} from '@/lib/shop/priceListingSlugs'

interface Props {
  params: Promise<{ pricingSlug: string }>
}

/** Legacy /product/{slug} → /shop/{slug} */
export default async function LegacyProductPricingRedirect({ params }: Props) {
  const { pricingSlug } = await params
  const parsed = parsePriceListingSlug(pricingSlug)
  if (!parsed) notFound()
  redirect(buildPriceListingHref(parsed.scope, parsed.rangeId))
}

export async function generateMetadata({ params }: Props) {
  const { pricingSlug } = await params
  const target = legacyProductPriceRedirect(`/product/${pricingSlug}`)
  if (!target) return {}
  return {}
}
