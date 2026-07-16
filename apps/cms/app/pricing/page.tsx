import { createServerClient } from '@amiora/database'
import { PricingClient } from './PricingClient'

export const dynamic = 'force-dynamic'

function readGoldPurityRates(meta: unknown) {
  if (!meta || typeof meta !== 'object') return { '09': null, '14': null, '18': null, '22': null }
  const source = (meta as { goldPurityRates?: unknown }).goldPurityRates
  if (!source || typeof source !== 'object') return { '09': null, '14': null, '18': null, '22': null }

  const read = (key: '09' | '14' | '18' | '22') => {
    const value = (source as Record<string, unknown>)[key]
    return value != null && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null
  }

  return {
    '09': read('09'),
    '14': read('14'),
    '18': read('18'),
    '22': read('22'),
  }
}

function readDiamondFromAuditMeta(meta: unknown): number {
  if (!meta || typeof meta !== 'object') return 0
  const diamond = (meta as { diamond?: unknown }).diamond
  return diamond != null && Number.isFinite(Number(diamond)) && Number(diamond) > 0 ? Number(diamond) : 0
}

export default async function PricingPage() {
  const supabase = createServerClient()

  const [goldRes, silverRes, diamondRes, diamondAuditRes] = await Promise.all([
    supabase
      .from('live_prices')
      .select('price_per_gram, fetched_at')
      .eq('metal', 'gold_999')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('live_prices')
      .select('price_per_gram, fetched_at')
      .eq('metal', 'silver_999')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('live_prices')
      .select('price_per_gram, fetched_at')
      .eq('metal', 'diamond_ct')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('admin_audit_logs')
      .select('meta, created_at')
      .eq('action', 'update_pricing_manual')
      .eq('resource', 'pricing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const fallbackDiamond = readDiamondFromAuditMeta(diamondAuditRes.data?.meta)
  const goldPurityRates = readGoldPurityRates(diamondAuditRes.data?.meta)

  return (
    <PricingClient
      currentGold={Number(goldRes.data?.price_per_gram ?? 7200)}
      currentSilver={Number(silverRes.data?.price_per_gram ?? 90)}
      currentDiamond={Number(diamondRes.data?.price_per_gram ?? fallbackDiamond)}
      goldUpdatedAt={goldRes.data?.fetched_at ?? null}
      silverUpdatedAt={silverRes.data?.fetched_at ?? null}
      diamondUpdatedAt={diamondRes.data?.fetched_at ?? diamondAuditRes.data?.created_at ?? null}
      goldPurityRates={goldPurityRates}
    />
  )
}
