import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import {
  assignShiprocketAwb,
  buildTrackingUrl,
  createShiprocketShipment,
  ShiprocketApiError,
  type AmioraOrderForShipment,
  type ShiprocketAddress,
} from '@/lib/shiprocket'

type Ctx = { params: Promise<{ id: string }> }

type OrderRow = {
  id: string
  order_number: string
  status: string
  created_at: string
  total_amount: number
  shipping_amount?: number | null
  discount_amount?: number | null
  shipping_address?: ShiprocketAddress | null
  pickup_store_id?: string | null
  awb_code?: string | null
  courier_name?: string | null
  tracking_url?: string | null
  shiprocket_order_id?: number | null
  shiprocket_shipment_id?: number | null
}

type OrderItemRow = {
  quantity: number
  unit_price: number
  metal_weight_g?: number | null
  size_label?: string | null
  product?: { name: string } | { name: string }[] | null
  variant?: { sku: string } | { sku: string }[] | null
}

const SHIPPABLE_STATUSES = new Set(['confirmed', 'processing'])

export async function POST(_req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('orders', 'edit')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const supabase = createServerClient()

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, created_at, total_amount, shipping_amount, discount_amount,
      shipping_address, pickup_store_id,
      awb_code, courier_name, tracking_url, shiprocket_order_id, shiprocket_shipment_id
    `)
    .eq('id', id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const row = order as OrderRow

  if (row.awb_code) {
    return NextResponse.json({
      awb_code: row.awb_code,
      courier_name: row.courier_name,
      tracking_url: row.tracking_url ?? buildTrackingUrl(row.awb_code),
      already_created: true,
    })
  }

  if (!SHIPPABLE_STATUSES.has(row.status)) {
    return NextResponse.json(
      { error: `Order must be confirmed or processing (current: ${row.status})` },
      { status: 400 },
    )
  }

  if (row.pickup_store_id) {
    return NextResponse.json(
      { error: 'Pickup orders cannot be shipped via Shiprocket' },
      { status: 400 },
    )
  }

  if (!row.shipping_address || typeof row.shipping_address !== 'object') {
    return NextResponse.json(
      { error: 'Order has no shipping address' },
      { status: 400 },
    )
  }

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select(`
      quantity, unit_price, metal_weight_g, size_label,
      product:products(name),
      variant:product_variants(sku)
    `)
    .eq('order_id', id)

  if (itemsErr || !items?.length) {
    return NextResponse.json({ error: 'Order has no items' }, { status: 400 })
  }

  const shipmentInput: AmioraOrderForShipment = {
    order_number: row.order_number,
    created_at: row.created_at,
    total_amount: Number(row.total_amount),
    shipping_amount: row.shipping_amount != null ? Number(row.shipping_amount) : null,
    discount_amount: row.discount_amount != null ? Number(row.discount_amount) : null,
    shipping_address: row.shipping_address,
    items: ((items ?? []) as unknown as OrderItemRow[]).map((item) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      const variant = Array.isArray(item.variant) ? item.variant[0] : item.variant
      return {
        name: product?.name ?? 'Jewellery Item',
        sku: variant?.sku ?? item.size_label ?? 'SKU',
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        metal_weight_g: item.metal_weight_g,
      }
    }),
  }

  try {
    const created = await createShiprocketShipment(shipmentInput)
    const awb = await assignShiprocketAwb(created.shipment_id)

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        shiprocket_order_id: created.shiprocket_order_id,
        shiprocket_shipment_id: created.shipment_id,
        awb_code: awb.awb_code,
        courier_name: awb.courier_name,
        tracking_url: awb.tracking_url,
        shipment_status: 'AWB ASSIGNED',
        status: 'processing',
      })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json(
        { error: `Shipment created but DB update failed: ${updateErr.message}` },
        { status: 500 },
      )
    }

    await writeAuditLog({
      adminId: perm.adminId,
      action: 'create_shiprocket_shipment',
      resource: 'orders',
      resourceId: id,
      meta: {
        awb_code: awb.awb_code,
        courier_name: awb.courier_name,
        shiprocket_order_id: created.shiprocket_order_id,
        shipment_id: created.shipment_id,
      },
    })

    return NextResponse.json({
      awb_code: awb.awb_code,
      courier_name: awb.courier_name,
      tracking_url: awb.tracking_url,
      shiprocket_order_id: created.shiprocket_order_id,
      shipment_id: created.shipment_id,
    })
  } catch (err) {
    const message =
      err instanceof ShiprocketApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to create Shiprocket shipment'

    console.error('[POST /api/orders/:id/shiprocket]', err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
