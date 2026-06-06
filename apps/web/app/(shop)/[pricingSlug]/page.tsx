import { notFound, redirect } from 'next/navigation'
import {
  parsePriceListingSlug,
  PRODUCT_PRICE_BASE,
} from '@/lib/shop/priceListingSlugs'

interface Props {
  params: Promise<{ pricingSlug: string }>
}

/** Legacy root-level price URLs → /product/{slug} */
export default async function LegacyPricingRedirect({ params }: Props) {
  const { pricingSlug } = await params
  if (!parsePriceListingSlug(pricingSlug)) notFound()
  redirect(`${PRODUCT_PRICE_BASE}/${pricingSlug}`)
}
