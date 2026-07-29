import type { SupabaseClient } from '@supabase/supabase-js'

export type CmsGoldPurityRates = {
  '09': number | null
  '14': number | null
  '18': number | null
  '22': number | null
}

export type CmsPricingContext = {
  currentGoldPerGram: number
  currentSilverPerGram: number
  currentDiamondPerCarat: number
  goldPurityRates: CmsGoldPurityRates
}

function readGoldPurityRates(meta: unknown): CmsGoldPurityRates {
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

export async function fetchCmsPricingContext(
  supabase: SupabaseClient,
): Promise<CmsPricingContext> {
  const [goldRes, silverRes, diamondRes, diamondAuditRes] = await Promise.all([
    supabase
      .from('live_prices')
      .select('price_per_gram')
      .eq('metal', 'gold_999')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('live_prices')
      .select('price_per_gram')
      .eq('metal', 'silver_999')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('live_prices')
      .select('price_per_gram')
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

  return {
    currentGoldPerGram: Number(goldRes.data?.price_per_gram ?? 7200),
    currentSilverPerGram: Number(silverRes.data?.price_per_gram ?? 90),
    currentDiamondPerCarat: Number(diamondRes.data?.price_per_gram ?? readDiamondFromAuditMeta(diamondAuditRes.data?.meta)),
    goldPurityRates: readGoldPurityRates(diamondAuditRes.data?.meta),
  }
}
