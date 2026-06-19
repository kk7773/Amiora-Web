import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'

type ShiprocketWebhookPayload = {
  awb?: string
  current_status?: string
  current_status_id?: number
  order_id?: string
  sr_order_id?: number
  courier_name?: string
  shipment_status?: string
  shipment_status_id?: number
}

function normalizeStatus(raw: string | undefined): string {
  return (raw ?? '').trim().toUpperCase()
}

function mapToOrderStatus(shiprocketStatus: string): 'shipped' | 'delivered' | null {
  const s = normalizeStatus(shiprocketStatus)

  if (s.includes('DELIVERED')) return 'delivered'
  if (
    s.includes('IN TRANSIT') ||
    s.includes('OUT FOR DELIVERY') ||
    s.includes('PICKED UP') ||
    s.includes('SHIPPED') ||
    s.includes('DISPATCHED') ||
    s.includes('REACHED')
  ) {
    return 'shipped'
  }

  return null
}

export async function POST(req: NextRequest) {
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET
  if (secret) {
    const apiKey = req.headers.get('x-api-key')
    if (apiKey !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: ShiprocketWebhookPayload
  try {
    body = (await req.json()) as ShiprocketWebhookPayload
  } catch {
    return NextResponse.json({ received: true })
  }

  const awb = body.awb?.trim()
  const srOrderId = body.sr_order_id != null ? Number(body.sr_order_id) : null
  const statusRaw = body.current_status ?? body.shipment_status ?? ''
  const mappedStatus = mapToOrderStatus(statusRaw)

  if (!awb && !Number.isFinite(srOrderId)) {
    return NextResponse.json({ received: true })
  }

  try {
    const supabase = createServerClient()

    let order: { id: string; status: string; shipped_at: string | null } | null = null

    if (awb) {
      const { data } = await supabase
        .from('orders')
        .select('id, status, shipped_at')
        .eq('awb_code', awb)
        .maybeSingle()
      if (data) order = data
    } else if (srOrderId != null) {
      const { data } = await supabase
        .from('orders')
        .select('id, status, shipped_at')
        .eq('shiprocket_order_id', srOrderId)
        .maybeSingle()
      if (data) order = data
    }

    if (!order) {
      console.warn('[webhooks/shiprocket] No order for', { awb, srOrderId })
      return NextResponse.json({ received: true })
    }

    const update: Record<string, unknown> = {
      shipment_status: statusRaw || null,
    }

    if (body.courier_name) {
      update.courier_name = body.courier_name
    }

    if (awb) {
      update.awb_code = awb
      update.tracking_url = `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`
    }

    if (mappedStatus === 'delivered') {
      update.status = 'delivered'
      if (!order.shipped_at) {
        update.shipped_at = new Date().toISOString()
      }
    } else if (mappedStatus === 'shipped' && order.status !== 'delivered') {
      update.status = 'shipped'
      if (!order.shipped_at) {
        update.shipped_at = new Date().toISOString()
      }
    }

    await supabase.from('orders').update(update).eq('id', order.id)

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhooks/shiprocket]', err)
    // Shiprocket expects 200 — log error but acknowledge
    return NextResponse.json({ received: true })
  }
}
