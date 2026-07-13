import { createServerClient } from '@amiora/database'
import { PricingClient } from './PricingClient'

export const dynamic = 'force-dynamic'

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

  return (
    <PricingClient
      currentGold={Number(goldRes.data?.price_per_gram ?? 7200)}
      currentSilver={Number(silverRes.data?.price_per_gram ?? 90)}
      currentDiamond={Number(diamondRes.data?.price_per_gram ?? fallbackDiamond)}
      goldUpdatedAt={goldRes.data?.fetched_at ?? null}
      silverUpdatedAt={silverRes.data?.fetched_at ?? null}
      diamondUpdatedAt={diamondRes.data?.fetched_at ?? diamondAuditRes.data?.created_at ?? null}
    />
  )
}
