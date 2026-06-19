import { shiprocketFetch } from './client'
import { getShiprocketToken } from './auth'
import type { AssignAwbResult, ShiprocketAssignAwbResponse } from './types'

export function buildTrackingUrl(awbCode: string): string {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`
}

export async function assignShiprocketAwb(shipmentId: number): Promise<AssignAwbResult> {
  const token = await getShiprocketToken()

  const data = await shiprocketFetch<ShiprocketAssignAwbResponse>(
    '/v1/external/courier/assign/awb',
    {
      method: 'POST',
      token,
      body: { shipment_id: shipmentId },
    },
  )

  const awbCode = data.response?.data?.awb_code
  const courierName = data.response?.data?.courier_name

  if (!awbCode) {
    throw new Error(data.message ?? 'AWB assignment failed — no awb_code in response')
  }

  return {
    awb_code: awbCode,
    courier_name: courierName ?? 'Courier',
    tracking_url: buildTrackingUrl(awbCode),
  }
}
