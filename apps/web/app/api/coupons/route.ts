import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/coupons — public list of active, non-expired coupons (for checkout UI).
 */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/coupons]', error)
      return NextResponse.json({ coupons: [] }, { status: 200 })
    }

    const now = new Date()
    const coupons = (data ?? [])
      .filter((c) => {
        if (c.expires_at && new Date(c.expires_at as string) < now) return false
        if (c.usage_limit != null && c.used_count >= c.usage_limit) return false
        return true
      })
      .map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        min_order_amount: c.min_order_amount,
        max_discount_amount: c.max_discount_amount,
        expires_at: c.expires_at,
        applies_to: (c as { applies_to?: string }).applies_to ?? 'both',
      }))

    return NextResponse.json({ coupons })
  } catch {
    return NextResponse.json({ coupons: [] })
  }
}
