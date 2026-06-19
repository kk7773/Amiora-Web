import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient } from '@amiora/database'
import { OrderConfirmationClient } from '@/components/checkout/OrderConfirmationClient'
import { fetchProductThumbnailMap } from '@/lib/shop/fetchProductThumbnailMap'

export const metadata: Metadata = { title: 'Order Confirmed!' }

interface Props {
  params: Promise<{ orderNumber: string }>
}

type OrderItemRow = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  product: { name: string; slug: string; product_images?: { url: string; is_primary: boolean }[] } | null
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  const { data: orderRaw } = await supabase
    .from('orders')
    .select('*, order_items(id, product_id, quantity, unit_price, product:products(name,slug,product_images(url,is_primary)))')
    .eq('order_number', orderNumber)
    .single()

  if (!orderRaw) {
    return (
      <div className="section-x py-24 text-center">
        <p className="font-display text-xl text-ink-muted">Order not found.</p>
        <Link href="/" className="mt-4 inline-block text-teal underline">Go home</Link>
      </div>
    )
  }

  const order = orderRaw as typeof orderRaw & { order_items: OrderItemRow[] }
  const productIds = order.order_items.map((i) => i.product_id).filter(Boolean)
  const thumbnailMap = await fetchProductThumbnailMap(supabase, productIds)

  const enrichedOrder = {
    ...order,
    order_items: order.order_items.map((item) => ({
      ...item,
      imageUrl:
        thumbnailMap[item.product_id] ??
        item.product?.product_images?.find((i) => i.is_primary)?.url ??
        item.product?.product_images?.[0]?.url ??
        null,
    })),
  }

  return (
    <OrderConfirmationClient
      order={enrichedOrder as Parameters<typeof OrderConfirmationClient>[0]['order']}
    />
  )
}
