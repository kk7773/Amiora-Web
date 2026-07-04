import type { Metadata } from 'next'
import Script from 'next/script'
import { createServerClient } from '@amiora/database'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'
import { getRazorpayServerCredentials } from '@/lib/razorpay/serverConfig'
import { pickVisibleStores } from '@/lib/storefrontStore'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const { keyId } = getRazorpayServerCredentials()
  const supabase = createServerClient()
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, address, city, state, pincode, phone')
    .eq('is_active', true)
    .order('name')

  const visibleStores = pickVisibleStores(stores ?? [])

  return (
    <>
      <StaticPageSchema title="Checkout" path="/checkout" />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <CheckoutClient razorpayKeyId={keyId} stores={visibleStores} />
    </>
  )
}
