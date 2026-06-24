import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getRazorpayWebhookSecret } from '@/lib/razorpay/serverConfig'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = getRazorpayWebhookSecret()

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
    }
    console.warn('[webhooks/razorpay] Missing webhook secret; accepting event for local/dev')
    return NextResponse.json({ received: true })
  }

  const expectedSignature = createHmac('sha256', secret).update(body).digest('hex')

  const expectedBuffer = Buffer.from(expectedSignature)
  const signatureBuffer = Buffer.from(signature)

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const payload = JSON.parse(body) as { event: string; payload: unknown }

  switch (payload.event) {
    case 'payment.captured':
      // Handle payment success — update order status
      break
    case 'payment.failed':
      // Handle payment failure
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}
