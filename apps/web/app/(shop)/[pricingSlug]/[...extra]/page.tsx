import { notFound, redirect } from 'next/navigation'
import {
  parsePriceListingSlug,
  PRODUCT_PRICE_BASE,
} from '@/lib/shop/priceListingSlugs'

interface Props {
  params: Promise<{ pricingSlug: string; extra: string[] }>
}

/** Legacy root-level price URLs → /product/{slug}/... */
export default async function LegacyPricingExtraRedirect({ params }: Props) {
  const { pricingSlug, extra } = await params
  if (!parsePriceListingSlug(pricingSlug)) notFound()
  redirect(`${PRODUCT_PRICE_BASE}/${pricingSlug}/${extra.join('/')}`)
}
