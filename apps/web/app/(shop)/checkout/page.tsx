import type { Metadata } from 'next'
import Script from 'next/script'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <>
      <StaticPageSchema title="Checkout" path="/checkout" />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <CheckoutClient />
    </>
  )
}
