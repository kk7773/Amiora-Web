import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

interface ManualPriceBody {
  gold?:   number | null
  silver?: number | null
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('pricing', 'edit')
  if (!perm.ok) return perm.response
  const body = (await req.json()) as ManualPriceBody
  const { gold, silver } = body

  if ((!gold || gold <= 0) && (!silver || silver <= 0)) {
    return NextResponse.json(
      { error: 'Provide at least one valid price (gold or silver > 0)' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const now = new Date().toISOString()

  const results = await Promise.allSettled([
    ...(gold && gold > 0
      ? [supabase.from('live_prices').insert({
          metal: 'gold_999',
          price_per_gram: gold,
          currency: 'INR',
          fetched_at: now,
        })]
      : []),
    ...(silver && silver > 0
      ? [supabase.from('live_prices').insert({
          metal: 'silver_999',
          price_per_gram: silver,
          currency: 'INR',
          fetched_at: now,
        })]
      : []),
  ])

  const failed = results.filter(
    (r) => r.status === 'rejected' ||
           (r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ error: unknown }>).value?.error)
  )

  if (failed.length > 0) {
    return NextResponse.json({ error: 'Failed to save one or more prices' }, { status: 500 })
  }

  await writeAuditLog({ adminId: perm.adminId, action: 'update_pricing_manual', resource: 'pricing', meta: { gold, silver } })
  return NextResponse.json({
    success: true,
    updated: { gold: gold ?? null, silver: silver ?? null },
    at: now,
  })
}
