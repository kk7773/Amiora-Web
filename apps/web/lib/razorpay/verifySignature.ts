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

  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(input.signature)

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer)
}
