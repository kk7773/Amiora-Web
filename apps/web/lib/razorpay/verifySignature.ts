import { createHmac, timingSafeEqual } from 'crypto'

export function verifyRazorpaySignature(input: {
  orderId: string
  paymentId: string
  signature: string
  keySecret: string
}): boolean {
  const expected = createHmac('sha256', input.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(input.signature),
  )
}
