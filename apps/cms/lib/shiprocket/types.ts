export const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in'

export type ShiprocketAddress = {
  full_name?: string
  phone?: string
  email?: string
  line1?: string
  line2?: string
  city?: string
  district?: string
  state?: string
  pincode?: string
}

export type ShiprocketOrderItem = {
  name: string
  sku: string
  quantity: number
  unit_price: number
  metal_weight_g?: number | null
}

export type AmioraOrderForShipment = {
  order_number: string
  created_at: string
  total_amount: number
  shipping_amount?: number | null
  discount_amount?: number | null
  shipping_address: ShiprocketAddress
  items: ShiprocketOrderItem[]
}

export type CreateShipmentResult = {
  shiprocket_order_id: number
  shipment_id: number
}

export type AssignAwbResult = {
  awb_code: string
  courier_name: string
  tracking_url: string
}

export type ShiprocketLoginResponse = {
  token?: string
  message?: string
}

export type ShiprocketCreateOrderResponse = {
  order_id?: number
  shipment_id?: number
  status?: number
  message?: string
}

export type ShiprocketAssignAwbResponse = {
  awb_assign_status?: number
  response?: {
    data?: {
      awb_code?: string
      courier_name?: string
      shipment_id?: number
    }
  }
  message?: string
}
