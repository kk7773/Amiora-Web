import { shiprocketFetch } from './client'
import { getShiprocketToken } from './auth'
import type {
  AmioraOrderForShipment,
  CreateShipmentResult,
  ShiprocketCreateOrderResponse,
} from './types'

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { first: fullName.trim() || 'Customer', last: '' }
  }
  return {
    first: parts[0] ?? 'Customer',
    last: parts.slice(1).join(' '),
  }
}

function computeWeightKg(items: AmioraOrderForShipment['items']): number {
  const grams = items.reduce((sum, item) => {
    const w = item.metal_weight_g ?? 0
    return sum + w * item.quantity
  }, 0)

  const fromItems = grams > 0 ? grams / 1000 : 0
  const fallback = envNumber('SHIPROCKET_DEFAULT_WEIGHT_KG', 0.2)
  return Math.max(fromItems || fallback, 0.1)
}

function formatOrderDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 16).replace('T', ' ')
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function createShiprocketShipment(
  order: AmioraOrderForShipment,
): Promise<CreateShipmentResult> {
  const token = await getShiprocketToken()
  const addr = order.shipping_address
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION ?? 'Primary'
  const { first, last } = splitName(addr.full_name ?? 'Customer')

  const subTotal = order.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  )

  const payload = {
    order_id: order.order_number.slice(0, 50),
    order_date: formatOrderDate(order.created_at),
    pickup_location: pickupLocation,
    billing_customer_name: first,
    billing_last_name: last,
    billing_address: addr.line1 ?? '',
    billing_address_2: addr.line2 ?? '',
    billing_city: addr.city ?? addr.district ?? '',
    billing_pincode: addr.pincode ?? '',
    billing_state: addr.state ?? '',
    billing_country: 'India',
    billing_email: addr.email ?? 'orders@amioradiamonds.in',
    billing_phone: (addr.phone ?? '').replace(/\D/g, '').slice(-10) || '9999999999',
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({
      name: item.name.slice(0, 200),
      sku: item.sku.slice(0, 50) || item.name.slice(0, 50),
      units: item.quantity,
      selling_price: String(Math.round(item.unit_price)),
      discount: '',
      tax: '',
      hsn: 7113,
    })),
    payment_method: 'Prepaid',
    shipping_charges: Number(order.shipping_amount ?? 0),
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: Number(order.discount_amount ?? 0),
    sub_total: Math.round(subTotal),
    length: envNumber('SHIPROCKET_DEFAULT_LENGTH_CM', 15),
    breadth: envNumber('SHIPROCKET_DEFAULT_BREADTH_CM', 15),
    height: envNumber('SHIPROCKET_DEFAULT_HEIGHT_CM', 10),
    weight: computeWeightKg(order.items),
  }

  const data = await shiprocketFetch<ShiprocketCreateOrderResponse>(
    '/v1/external/orders/create/adhoc',
    { method: 'POST', token, body: payload },
  )

  const shiprocketOrderId = Number(data.order_id)
  const shipmentId = Number(data.shipment_id)

  if (!Number.isFinite(shiprocketOrderId) || !Number.isFinite(shipmentId)) {
    throw new Error(data.message ?? 'Shiprocket order created but missing order_id or shipment_id')
  }

  return {
    shiprocket_order_id: shiprocketOrderId,
    shipment_id: shipmentId,
  }
}
