import { notFound, redirect } from 'next/navigation'
import {
  buildPriceListingHref,
  parsePriceListingSlug,
} from '@/lib/shop/priceListingSlugs'

interface Props {
  params: Promise<{ pricingSlug: string; extra: string[] }>
}

/** Legacy root-level price URLs with tail → /shop/{slug} */
export default async function LegacyPricingExtraRedirect({ params }: Props) {
  const { pricingSlug } = await params
  const parsed = parsePriceListingSlug(pricingSlug)
  if (!parsed) notFound()
  redirect(buildPriceListingHref(parsed.scope, parsed.rangeId))
}
