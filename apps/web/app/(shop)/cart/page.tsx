import type { Metadata } from 'next'
import { CartPageClient } from '@/components/cart/CartPageClient'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export const metadata: Metadata = {
  title: 'Your Cart',
}

export default function CartPage() {
  return (
    <>
      <StaticPageSchema title="Your Cart" path="/cart" />
      <CartPageClient />
    </>
  )
}
