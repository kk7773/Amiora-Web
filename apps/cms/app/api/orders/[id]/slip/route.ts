import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createAdminClient } from '@amiora/database'
import {
  buildOrderSlipFilename,
  buildOrderSlipHtml,
  type OrderSlipData,
  type OrderSlipItem,
} from '@amiora/types'
import { requireCmsAccess } from '@/lib/rbac'

type Ctx = {
  params: Promise<{ id: string }>
}

function getKind(searchParams: URLSearchParams) {
  return searchParams.get('kind') === 'packing' ? 'packing' : 'order'
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('orders', 'view')
  if (perm.ok === false) return perm.response

  const { id } = await params
  const kind = getKind(new URL(req.url).searchParams)
  const adminClient = createAdminClient()

  const { data: order, error } = await adminClient
    .from('orders')
    .select('id, order_number, status, created_at, total_amount, subtotal, shipping_amount, discount_amount, payment_mode, payment_status, payment_ref, delivery_method, pickup_date, guest_email, shipping_address, awb_code, courier_name, tracking_url')
    .eq('id', id)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: items, error: itemsError } = await adminClient
    .from('order_items')
    .select('product_name, variant_label, quantity, unit_price, subtotal, size_label')
    .eq('order_id', id)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const html = buildOrderSlipHtml({
    kind,
    order: order as OrderSlipData,
    items: (items ?? []) as OrderSlipItem[],
    shopName: 'Amiora Diamonds',
  })

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${buildOrderSlipFilename(order.order_number, kind)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
