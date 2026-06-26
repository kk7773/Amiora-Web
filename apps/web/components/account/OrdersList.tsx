'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, X, ChevronRight, Truck, ExternalLink, Download } from 'lucide-react'
import { formatINR } from '@/lib/pricing/calculator'

const STATUS_STYLES: Record<string, string> = {
  pending:           'bg-yellow-50 text-yellow-700',
  confirmed:         'bg-blue-50 text-blue-700',
  processing:        'bg-purple-50 text-purple-700',
  shipped:           'bg-teal/10 text-teal',
  delivered:         'bg-green-50 text-green-700',
  cancelled:         'bg-red-50 text-red-500',
  booked_for_pickup: 'bg-sand/20 text-sand',
}

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  size_label: string | null
  imageUrl?: string | null
  product: { name: string; slug: string; product_images?: { url: string; is_primary: boolean }[] } | null
}

interface Order {
  id: string
  order_number: string
  subtotal?: number
  shipping_amount?: number
  discount_amount?: number
  coupon_code?: string | null
  total_amount: number
  status: string
  payment_mode?: string | null
  payment_status?: string | null
  payment_ref?: string | null
  created_at: string
  delivery_method: string
  pickup_date: string | null
  shipping_address?: {
    full_name?: string
    phone?: string
    line1?: string
    line2?: string
    city?: string
    district?: string
    state?: string
    pincode?: string
    email?: string
  } | null
  awb_code?: string | null
  courier_name?: string | null
  tracking_url?: string | null
  order_items: OrderItem[]
}

export function OrdersList({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Order | null>(null)

  if (!orders.length) {
    return (
      <div className="py-20 text-center space-y-4">
        <Package className="mx-auto h-12 w-12 text-ink-faint" />
        <p className="font-display text-xl text-ink-muted">No orders yet</p>
        <Link href="/shop" className="inline-block text-sm text-teal underline underline-offset-4">Start Shopping →</Link>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-surface rounded-2xl p-5 hover:shadow-sm transition-shadow cursor-pointer"
            onClick={() => setSelected(order)}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <p className="font-medium text-ink">{order.order_number}</p>
                  <span className={`text-2xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${STATUS_STYLES[order.status] ?? 'bg-surface-2 text-ink-muted'}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-ink-muted">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-deep-teal">{formatINR(order.total_amount)}</p>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </div>
            </div>

            {/* Item thumbnails */}
            <div className="flex gap-2 mt-4">
              {order.order_items.slice(0, 4).map((item) => {
                const imgUrl =
                  item.imageUrl ??
                  item.product?.product_images?.find((i) => i.is_primary)?.url ??
                  item.product?.product_images?.[0]?.url
                return (
                  <div key={item.id} className="relative h-12 w-12 rounded-md overflow-hidden bg-surface-2 shrink-0">
                    {imgUrl ? <Image src={imgUrl} alt="" fill className="object-cover" sizes="48px" /> : null}
                  </div>
                )
              })}
              {order.order_items.length > 4 && (
                <div className="h-12 w-12 rounded-md bg-surface-2 flex items-center justify-center text-xs text-ink-muted">
                  +{order.order_items.length - 4}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order detail modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-x-4 bottom-0 top-20 z-50 max-w-2xl mx-auto bg-bg rounded-t-2xl overflow-y-auto"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-display text-xl text-ink">Order {selected.order_number}</h2>
                    <p className="text-xs text-ink-muted">Download slips for your records or packing.</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 text-ink-muted hover:text-ink transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium uppercase tracking-wider ${STATUS_STYLES[selected.status] ?? 'bg-surface-2 text-ink-muted'}`}>
                    {selected.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-ink-faint">{new Date(selected.created_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <a
                    href={`/api/orders/${selected.order_number}/slip?kind=packing`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-divider px-4 py-3 text-sm font-medium text-ink hover:border-teal hover:text-teal transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download Packing Slip
                  </a>
                  <a
                    href={`/api/orders/${selected.order_number}/slip?kind=order`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-deep-teal px-4 py-3 text-sm font-medium text-cream hover:bg-teal transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download Order Slip
                  </a>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-divider bg-surface p-4 space-y-1.5">
                    <div className="text-xs font-medium uppercase tracking-wider text-ink-faint">Payment</div>
                    <p className="text-sm text-ink">Mode: {selected.payment_mode ?? 'online'}</p>
                    <p className="text-sm text-ink">Status: {selected.payment_status ?? 'pending'}</p>
                    {selected.payment_ref && <p className="text-xs text-ink-muted break-all">Ref: {selected.payment_ref}</p>}
                  </div>
                  <div className="rounded-xl border border-divider bg-surface p-4 space-y-1.5">
                    <div className="text-xs font-medium uppercase tracking-wider text-ink-faint">Delivery</div>
                    <p className="text-sm text-ink capitalize">{selected.delivery_method === 'pickup' ? 'Store pickup' : 'Home delivery'}</p>
                    {selected.pickup_date && <p className="text-xs text-ink-muted">Pickup: {new Date(selected.pickup_date).toLocaleDateString('en-IN')}</p>}
                    {selected.shipping_address?.city && <p className="text-xs text-ink-muted">{selected.shipping_address.city}, {selected.shipping_address.state}</p>}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  {selected.order_items.map((item) => {
                    const imgUrl =
                      item.imageUrl ??
                      item.product?.product_images?.find((i) => i.is_primary)?.url ??
                      item.product?.product_images?.[0]?.url
                    return (
                      <div key={item.id} className="flex gap-4 py-3 border-b border-divider last:border-0">
                        <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-surface shrink-0">
                          {imgUrl && <Image src={imgUrl} alt="" fill className="object-cover" sizes="64px" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/products/${item.product?.slug}`} className="text-sm font-medium text-ink hover:text-deep-teal transition-colors line-clamp-2">
                            {item.product?.name}
                          </Link>
                          <p className="text-xs text-ink-muted mt-0.5">Qty: {item.quantity}{item.size_label ? ` · Size: ${item.size_label}` : ''}</p>
                        </div>
                        <p className="text-sm font-medium text-ink shrink-0">{formatINR(item.unit_price * item.quantity)}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Total */}
                <div className="border-t border-divider pt-4 space-y-2">
                  {selected.subtotal != null && (
                    <div className="flex justify-between text-sm text-ink-muted">
                      <span>Subtotal</span>
                      <span>{formatINR(selected.subtotal)}</span>
                    </div>
                  )}
                  {(selected.discount_amount ?? 0) > 0 && (
                    <div className="flex justify-between text-sm text-teal">
                      <span>Coupon {selected.coupon_code ? `(${selected.coupon_code})` : ''}</span>
                      <span>-{formatINR(selected.discount_amount ?? 0)}</span>
                    </div>
                  )}
                  {selected.shipping_amount != null && (
                    <div className="flex justify-between text-sm text-ink-muted">
                      <span>Shipping</span>
                      <span>{selected.shipping_amount === 0 ? 'FREE' : formatINR(selected.shipping_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold text-ink pt-2">
                    <span>Total</span>
                    <span>{formatINR(selected.total_amount)}</span>
                  </div>
                </div>

                {selected.shipping_address && selected.delivery_method !== 'pickup' && (
                  <div className="rounded-xl border border-divider bg-surface p-4 space-y-1.5">
                    <div className="text-xs font-medium uppercase tracking-wider text-ink-faint">Shipping Address</div>
                    {selected.shipping_address.full_name && <p className="text-sm text-ink">{selected.shipping_address.full_name}</p>}
                    {selected.shipping_address.phone && <p className="text-sm text-ink-muted">{selected.shipping_address.phone}</p>}
                    {selected.shipping_address.email && <p className="text-sm text-ink-muted break-all">{selected.shipping_address.email}</p>}
                    <p className="text-sm text-ink-muted">
                      {selected.shipping_address.line1}
                      {selected.shipping_address.line2 ? `, ${selected.shipping_address.line2}` : ''}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {selected.shipping_address.city}
                      {selected.shipping_address.district ? `, ${selected.shipping_address.district}` : ''}
                      {selected.shipping_address.state ? `, ${selected.shipping_address.state}` : ''}
                      {selected.shipping_address.pincode ? ` - ${selected.shipping_address.pincode}` : ''}
                    </p>
                  </div>
                )}

                {/* Shipment tracking */}
                {selected.awb_code && (
                  <div className="rounded-xl border border-divider bg-surface p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Truck className="h-4 w-4 text-teal" />
                      Shipment
                    </div>
                    <p className="text-sm text-ink-muted">
                      AWB: <span className="font-mono text-ink">{selected.awb_code}</span>
                      {selected.courier_name ? ` · ${selected.courier_name}` : ''}
                    </p>
                    <a
                      href={selected.tracking_url ?? `https://shiprocket.co/tracking/${selected.awb_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-deep-teal"
                    >
                      Track shipment <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}

                {/* Actions */}
                {(selected.status === 'pending' || selected.status === 'confirmed') && (
                  <button className="w-full py-3 border border-red-200 text-red-500 text-sm rounded-xl hover:bg-red-50 transition-colors">
                    Cancel Order
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
