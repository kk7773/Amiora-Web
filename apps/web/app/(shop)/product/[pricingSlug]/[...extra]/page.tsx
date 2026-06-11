import { notFound, redirect } from 'next/navigation'
import {
  buildPriceListingHref,
  parsePriceListingSlug,
} from '@/lib/shop/priceListingSlugs'

interface Props {
  params: Promise<{ pricingSlug: string; extra: string[] }>
}

/** Legacy /product/{slug}/... → /shop/{slug} */
export default async function LegacyProductPricingExtraRedirect({ params }: Props) {
  const { pricingSlug } = await params
  const parsed = parsePriceListingSlug(pricingSlug)
  if (!parsed) notFound()
  redirect(buildPriceListingHref(parsed.scope, parsed.rangeId))
}
