import { createServerClient } from '@amiora/database'
import { OrdersClient } from '@/components/tables/OrdersClient'

export default async function OrdersPage() {
  const supabase = createServerClient()
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, total_amount, subtotal, shipping_amount, discount_amount, status, payment_mode, payment_status, payment_ref, guest_email, created_at,
      shipping_address, pickup_store_id, pickup_date, delivery_method, awb_code, courier_name, tracking_url,
      user:user_profiles(full_name, phone),
      items:order_items(id, quantity, unit_price, variant_label,
        product:products(name, slug, images:product_images(url, is_primary))
      )
    `)
    .order('created_at', { ascending: false })

  const { data: stores } = await supabase.from('stores').select('id, name')

  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl text-deep-teal">Orders</h2>
      <OrdersClient orders={(orders ?? []) as unknown as Parameters<typeof OrdersClient>[0]['orders']} stores={(stores ?? []) as unknown as Parameters<typeof OrdersClient>[0]['stores']} />
    </div>
  )
}
