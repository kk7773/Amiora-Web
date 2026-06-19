import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { OrdersList } from '@/components/account/OrdersList'
import { fetchProductThumbnailMap } from '@/lib/shop/fetchProductThumbnailMap'

export const metadata: Metadata = { title: 'My Orders' }

type OrderItemRow = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  size_label: string | null
  product: { name: string; slug: string; product_images: { url: string; is_primary: boolean }[] } | null
}

type OrderRow = {
  id: string
  order_number: string
  total_amount: number
  status: string
  created_at: string
  delivery_method: string
  pickup_date: string | null
  awb_code: string | null
  courier_name: string | null
  tracking_url: string | null
  order_items: OrderItemRow[]
}

export default async function OrdersPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ordersRaw } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, status, created_at, delivery_method, pickup_date, awb_code, courier_name, tracking_url, order_items(id, product_id, quantity, unit_price, size_label, product:products(name,slug,product_images(url,is_primary)))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const orders = (ordersRaw ?? []) as unknown as OrderRow[]
  const productIds = [
    ...new Set(
      orders.flatMap((o) => o.order_items.map((i) => i.product_id).filter(Boolean)),
    ),
  ]
  const thumbnailMap = await fetchProductThumbnailMap(supabase, productIds)

  const enrichedOrders = orders.map((order) => ({
    ...order,
    order_items: order.order_items.map((item) => ({
      ...item,
      imageUrl:
        thumbnailMap[item.product_id] ??
        item.product?.product_images.find((i) => i.is_primary)?.url ??
        item.product?.product_images[0]?.url ??
        null,
    })),
  }))

  return (
    <div>
      <h1 className="font-display text-display-xl text-ink mb-8">My Orders</h1>
      <OrdersList orders={enrichedOrders} />
    </div>
  )
}
