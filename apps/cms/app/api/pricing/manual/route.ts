import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

interface ManualPriceBody {
  gold?:   number | null
  silver?: number | null
  diamond?: number | null
  goldPurityRates?: Record<string, number | null | undefined>
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('pricing', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const body = (await req.json()) as ManualPriceBody
    const { gold, silver, diamond, goldPurityRates } = body
    const normalizedGoldPurityRates = Object.fromEntries(
      Object.entries(goldPurityRates ?? {})
        .map(([key, value]) => [key, value != null && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null]),
    )

    const hasGoldPurityRate = Object.values(normalizedGoldPurityRates).some((value) => value != null && value > 0)

    if ((!gold || gold <= 0) && (!silver || silver <= 0) && (!diamond || diamond <= 0) && !hasGoldPurityRate) {
      return NextResponse.json(
        { error: 'Provide at least one valid price (gold, silver, diamond, or gold purity rates > 0)' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const now = new Date().toISOString()

    const failed: Array<{ field: 'gold' | 'silver' | 'diamond'; error: unknown }> = []

    if (gold && gold > 0) {
      const result = await supabase.from('live_prices').insert({
        metal: 'gold_999',
        price_per_gram: gold,
        currency: 'INR',
        fetched_at: now,
      })
      if (result.error) failed.push({ field: 'gold', error: result.error })
    }

    if (silver && silver > 0) {
      const result = await supabase.from('live_prices').insert({
        metal: 'silver_999',
        price_per_gram: silver,
        currency: 'INR',
        fetched_at: now,
      })
      if (result.error) failed.push({ field: 'silver', error: result.error })
    }

    if (diamond && diamond > 0) {
      const diamondInsert = await supabase.from('live_prices').insert({
        metal: 'diamond_ct',
        price_per_gram: diamond,
        currency: 'INR',
        fetched_at: now,
      })

      if (diamondInsert.error) {
        console.warn('[pricing/manual] live_prices diamond_ct insert failed; falling back to audit-log-backed manual diamond rate', diamondInsert.error)
      }
    }

    if (failed.length > 0) {
      console.error('[pricing/manual] insert failed', failed)
      return NextResponse.json({ error: 'Failed to save one or more prices', details: failed }, { status: 500 })
    }

    await writeAuditLog({
      adminId: perm.adminId,
      action: 'update_pricing_manual',
      resource: 'pricing',
      meta: { gold, silver, diamond, goldPurityRates: normalizedGoldPurityRates },
    })
    return NextResponse.json({
      success: true,
      updated: { gold: gold ?? null, silver: silver ?? null, diamond: diamond ?? null, goldPurityRates: normalizedGoldPurityRates },
      at: now,
    })
  } catch (err: unknown) {
    console.error('[pricing/manual]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save prices' },
      { status: 500 },
    )
  }
}
