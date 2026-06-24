import { NextRequest, NextResponse } from 'next/server'
import { computeCartQuote } from '@/lib/checkout/computeCartQuote'
import { createServerClient } from '@amiora/database'
import type { CartLine } from '@/lib/coupons/evaluateCoupon'
import { getRazorpayServerCredentials } from '@/lib/razorpay/serverConfig'

function maskCredential(value: string): string {
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items?: CartLine[]
      coupon_code?: string
      delivery_method?: string
    }

    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const quote = await computeCartQuote(supabase, {
      items,
      coupon_code: body.coupon_code,
      delivery_method: body.delivery_method,
      validateStock: true,
    })

    if (quote.lines.length === 0) {
      return NextResponse.json({ error: quote.errors[0] ?? 'Could not price cart' }, { status: 400 })
    }

    if (!Number.isFinite(quote.grand_total) || quote.grand_total <= 0) {
      return NextResponse.json({ error: 'Cart total is invalid' }, { status: 400 })
    }

    if (body.coupon_code?.trim() && !quote.coupon) {
      return NextResponse.json(
        { error: quote.errors.find((e) => e.toLowerCase().includes('coupon')) ?? 'Coupon is not applicable' },
        { status: 400 },
      )
    }

    const itemErrors = quote.errors.filter((e) => !e.toLowerCase().includes('coupon'))
    if (itemErrors.length > 0) {
      return NextResponse.json({ error: itemErrors[0] }, { status: 400 })
    }

    const { keyId, keySecret } = getRazorpayServerCredentials()

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === 'production'
              ? 'Payment gateway not configured'
              : 'Sandbox Razorpay credentials are not configured. Set RAZORPAY_SANDBOX_KEY_ID and RAZORPAY_SANDBOX_KEY_SECRET in .env.local, or use RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then restart the dev server.',
        },
        { status: 503 },
      )
    }

    const amountInPaise = Math.round(quote.grand_total * 100)
    if (!Number.isInteger(amountInPaise) || amountInPaise <= 0) {
      return NextResponse.json({ error: 'Payment amount is invalid' }, { status: 400 })
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   Math.round(quote.grand_total * 100),
        currency: 'INR',
        receipt:  `rcpt_${Date.now()}`,
        notes: {
          delivery_method: body.delivery_method ?? 'online',
          coupon_code: body.coupon_code?.trim().toUpperCase() ?? '',
        },
      }),
    })

    const data = (await response.json()) as {
      id?: string
      currency?: string
      error?: { description?: string; code?: string; field?: string }
    }

    if (!response.ok || !data.id) {
      const razorpayError =
        data.error?.description ??
        'Payment order creation failed'
      const isAuthFailure =
        response.status === 401 ||
        response.status === 403 ||
        /auth/i.test(razorpayError)

      return NextResponse.json(
        {
          error: isAuthFailure
            ? 'Razorpay authentication failed. Check RAZORPAY_KEY_ID / NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your env, then restart the server.'
            : razorpayError,
          details: data.error ?? null,
          debug:
            process.env.NODE_ENV === 'production'
              ? undefined
              : {
                  key_id: maskCredential(keyId),
                  key_secret_length: keySecret.length,
                },
        },
        { status: isAuthFailure ? 401 : 502 },
      )
    }

    return NextResponse.json({
      id: data.id,
      currency: data.currency ?? 'INR',
      grand_total: quote.grand_total,
    })
  } catch {
    return NextResponse.json({ error: 'Payment order creation failed' }, { status: 500 })
  }
}
