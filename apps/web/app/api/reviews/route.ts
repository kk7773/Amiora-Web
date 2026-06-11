import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient as createServiceClient } from '@amiora/database'
import { createServerClient } from '@/lib/supabase/server'

const schema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  body: z.string().min(10, 'Review must be at least 10 characters').max(2000),
  reviewerName: z.string().min(2).max(80).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const { productId, rating, title, body, reviewerName } = parsed.data

    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()

    const db = createServiceClient()

    const { data: product } = await db
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('status', 'active')
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    let resolvedName = reviewerName?.trim() ?? null
    let userId: string | null = null

    if (user) {
      userId = user.id
      const { data: profile } = await db
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      resolvedName =
        profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split('@')[0] ??
        'Customer'
    } else if (!resolvedName) {
      return NextResponse.json({ error: 'Please enter your name' }, { status: 400 })
    }

    if (userId) {
      const { data: existing } = await db
        .from('reviews')
        .select('id, status')
        .eq('product_id', productId)
        .eq('user_id', userId)
        .in('status', ['pending', 'approved'])
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'You have already reviewed this product' },
          { status: 409 },
        )
      }
    }

    const { error } = await db.from('reviews').insert({
      product_id: productId,
      user_id: userId,
      reviewer_name: resolvedName,
      rating,
      title: title?.trim() || null,
      body: body.trim(),
      status: 'pending',
      is_approved: false,
      is_verified: false,
      is_verified_purchase: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
