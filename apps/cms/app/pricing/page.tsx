import { createServerClient } from '@amiora/database'
import { PricingClient } from './PricingClient'

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const supabase = createServerClient()

  const [goldRes, silverRes, diamondRes] = await Promise.all([
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
  ])

  return (
    <PricingClient
      currentGold={Number(goldRes.data?.price_per_gram ?? 7200)}
      currentSilver={Number(silverRes.data?.price_per_gram ?? 90)}
      currentDiamond={Number(diamondRes.data?.price_per_gram ?? 0)}
      goldUpdatedAt={goldRes.data?.fetched_at ?? null}
      silverUpdatedAt={silverRes.data?.fetched_at ?? null}
      diamondUpdatedAt={diamondRes.data?.fetched_at ?? null}
    />
  )
}
