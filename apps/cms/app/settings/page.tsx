import { createServerClient } from '@amiora/database'
import { SettingsClient } from '@/components/forms/SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createServerClient()

  const [goldRes, silverRes, settingsRes] = await Promise.all([
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
      .from('site_settings')
      .select('key, value')
      .in('key', ['making_charge_pct', 'announcement_bar']),
  ])

  const settingsMap = Object.fromEntries((settingsRes.data ?? []).map((row) => [row.key, row.value]))
  const makingChargePct = Number(settingsMap.making_charge_pct ?? 8)
  const announcementBar = settingsMap.announcement_bar ?? ''

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="font-display text-2xl text-deep-teal">Settings</h2>
      <SettingsClient
        currentGold={Number(goldRes.data?.price_per_gram ?? 7200)}
        currentSilver={Number(silverRes.data?.price_per_gram ?? 90)}
        goldUpdatedAt={goldRes.data?.fetched_at ?? null}
        silverUpdatedAt={silverRes.data?.fetched_at ?? null}
        initialMakingChargePct={Number.isFinite(makingChargePct) ? makingChargePct : 8}
        initialAnnouncement={announcementBar}
      />
    </div>
  )
}
