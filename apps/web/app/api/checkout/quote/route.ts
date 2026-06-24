import { NextRequest, NextResponse } from 'next/server'

import { createServerClient } from '@amiora/database'

import { computeCheckoutQuoteWithCoupons } from '@/lib/checkout/computeCartQuote'

import type { CartLine } from '@/lib/coupons/evaluateCoupon'



/**

 * POST /api/checkout/quote

 * Server-authoritative cart pricing + coupon evaluation (single priceCartLines pass).

 */

export async function POST(req: NextRequest) {

  try {

    const body = (await req.json()) as {

      items?: CartLine[]

      coupon_code?: string

      delivery_method?: string

    }



    const items = Array.isArray(body.items) ? body.items : []

    const supabase = await createServerClient()



    const result = await computeCheckoutQuoteWithCoupons(supabase, {

      items,

      coupon_code: body.coupon_code,

      delivery_method: body.delivery_method,

      validateStock: false,

    })



    return NextResponse.json(result)

  } catch (err) {

    console.error('[POST /api/checkout/quote]', err)

    return NextResponse.json({ error: 'Could not calculate cart total' }, { status: 500 })

  }

}

