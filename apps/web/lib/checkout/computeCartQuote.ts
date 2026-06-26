import type { SupabaseClient } from '@supabase/supabase-js'
import {
  evaluateCoupon,
  type CartLine,
  type CouponRow,
} from '@/lib/coupons/evaluateCoupon'
import { evaluateAllCoupons, type EvaluatedCouponResult } from '@/lib/coupons/evaluateAllCoupons'
import { priceCartLines, type PriceCartLinesResult, type PricedCartLine } from '@/lib/checkout/priceCartLines'

export const SHIPPING_FEE = 1
export const FREE_SHIPPING_THRESHOLD = 5000

export type CartQuoteCoupon = {
  id: string
  code: string
  total_discount: number
}

export type CartQuote = {
  lines: PricedCartLine[]
  subtotal: number
  discount_amount: number
  subtotal_after_coupon: number
  shipping: number
  grand_total: number
  coupon: CartQuoteCoupon | null
  errors: string[]
}

export function computeShipping(subtotalAfterCoupon: number, deliveryMethod: string): number {
  if (deliveryMethod === 'pickup') return 0
  return subtotalAfterCoupon >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}

export type ComputeCartQuoteInput = {
  items: CartLine[]
  coupon_code?: string | null
  delivery_method?: string
  validateStock?: boolean
}

export type CheckoutQuoteResponse = CartQuote & {
  coupons: EvaluatedCouponResult[]
}

function buildCartQuoteFromPriced(
  priced: PriceCartLinesResult,
  input: { coupon_code?: string | null; delivery_method?: string },
  couponRow: CouponRow | null,
  evaluation: ReturnType<typeof evaluateCoupon> | null,
): CartQuote {
  const deliveryMethod = input.delivery_method ?? 'online'
  const { lines, errors } = priced

  if (lines.length === 0 && errors.length === 0) {
    errors.push('No valid items in cart')
  }

  const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0)

  let discountAmount = 0
  let coupon: CartQuoteCoupon | null = null

  if (couponRow && evaluation?.applicable) {
    discountAmount = evaluation.total_discount
    coupon = {
      id: couponRow.id,
      code: couponRow.code,
      total_discount: evaluation.total_discount,
    }
  } else if (input.coupon_code?.trim() && couponRow === null) {
    errors.push('Invalid coupon code')
  } else if (couponRow && evaluation && !evaluation.applicable) {
    errors.push(evaluation.reason ?? 'Coupon is not applicable to this order')
  }

  const subtotalAfterCoupon = Math.max(0, subtotal - discountAmount)
  const shipping = computeShipping(subtotalAfterCoupon, deliveryMethod)
  const grandTotal = subtotalAfterCoupon + shipping

  return {
    lines,
    subtotal,
    discount_amount: discountAmount,
    subtotal_after_coupon: subtotalAfterCoupon,
    shipping,
    grand_total: grandTotal,
    coupon,
    errors,
  }
}

export async function computeCheckoutQuoteWithCoupons(
  supabase: SupabaseClient,
  input: ComputeCartQuoteInput,
): Promise<CheckoutQuoteResponse> {
  const items = Array.isArray(input.items) ? input.items : []

  if (items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      discount_amount: 0,
      subtotal_after_coupon: 0,
      shipping: 0,
      grand_total: 0,
      coupon: null,
      errors: ['Cart is empty'],
      coupons: [],
    }
  }

  const priced = await priceCartLines(supabase, items, {
    validateStock: input.validateStock ?? false,
  })

  const code = input.coupon_code?.trim().toUpperCase()
  let couponRow: CouponRow | null = null
  let evaluation: ReturnType<typeof evaluateCoupon> | null = null

  if (code && priced.lines.length > 0) {
    const { data, error: couponErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (!couponErr && data) {
      couponRow = data as CouponRow
      evaluation = evaluateCoupon(couponRow, priced.components)
    }
  }

  const quote = buildCartQuoteFromPriced(
    priced,
    { coupon_code: input.coupon_code, delivery_method: input.delivery_method },
    couponRow,
    evaluation,
  )

  const coupons = await evaluateAllCoupons(supabase, priced.components)

  return { ...quote, coupons }
}

export async function computeCartQuote(
  supabase: SupabaseClient,
  input: ComputeCartQuoteInput,
): Promise<CartQuote> {
  const deliveryMethod = input.delivery_method ?? 'online'
  const items = Array.isArray(input.items) ? input.items : []

  if (items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      discount_amount: 0,
      subtotal_after_coupon: 0,
      shipping: 0,
      grand_total: 0,
      coupon: null,
      errors: ['Cart is empty'],
    }
  }

  const priced = await priceCartLines(supabase, items, {
    validateStock: input.validateStock ?? true,
  })

  const code = input.coupon_code?.trim().toUpperCase()
  let couponRow: CouponRow | null = null
  let evaluation: ReturnType<typeof evaluateCoupon> | null = null

  if (code && priced.lines.length > 0) {
    const { data: couponRowData, error: couponErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (!couponErr && couponRowData) {
      couponRow = couponRowData as CouponRow
      evaluation = evaluateCoupon(couponRow, priced.components)
    }
  }

  return buildCartQuoteFromPriced(
    priced,
    { coupon_code: input.coupon_code, delivery_method: deliveryMethod },
    couponRow,
    evaluation,
  )
}
