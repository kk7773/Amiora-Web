/**
 * Pricing Engine — Amiora Diamonds
 *
 * Responsibilities:
 *   1. Fetch latest gold/silver prices from an external API
 *   2. Store them in Supabase live_prices table
 *   3. Provide a getLatestPrice() utility for SSR and API routes
 *   4. Expose calculateProductPrice() for computing product prices server-side
 *
 * External API used: goldapi.io (free tier)
 *   GET https://www.goldapi.io/api/{metal}/{currency}
 *   Returns: price_gram_24k (USD/gram for 999 purity gold)
 *
 * Fallback: If API fails, returns last stored price from Supabase.
 */

import { unstable_cache } from 'next/cache'
import { createServerClient } from '@amiora/database'
import { normalizeGoldPurityRateKey, calculateVariantPrice, type GoldPurityRates, type PriceBreakdown } from '@amiora/pricing'
import type { LivePrice } from '@amiora/types'

const GOLD_API_BASE = 'https://www.goldapi.io/api'
const GOLD_API_KEY  = process.env['GOLD_API_KEY'] ?? ''

// Exchange rate API (free tier) — USD → INR
const EXCHANGE_API = 'https://api.exchangerate-api.com/v4/latest/USD'

// ─────────────────────────────────────────────────────────────────────────────
// Fetch & Store
// ─────────────────────────────────────────────────────────────────────────────

interface GoldApiResponse {
  price: number            // USD per troy oz
  price_gram_24k: number   // USD per gram (999 purity)
  price_gram_22k: number
  price_gram_18k: number
}

interface ExchangeRateResponse {
  rates: Record<string, number>
}

function readDiamondManualRate(meta: unknown): number | null {
  if (!meta || typeof meta !== 'object') return null
  const diamond = (meta as { diamond?: unknown }).diamond
  return diamond != null && Number.isFinite(Number(diamond)) && Number(diamond) > 0 ? Number(diamond) : null
}

function readGoldPurityManualRates(meta: unknown): GoldPurityRates {
  if (!meta || typeof meta !== 'object') return {}
  const source = (meta as { goldPurityRates?: unknown }).goldPurityRates
  if (!source || typeof source !== 'object') return {}

  const result: GoldPurityRates = {}
  for (const [rawKey, rawValue] of Object.entries(source as Record<string, unknown>)) {
    const key = normalizeGoldPurityRateKey(rawKey)
    const value = Number(rawValue)
    if (key && Number.isFinite(value) && value > 0) result[key] = value
  }
  return result
}

/**
 * Fetch USD→INR exchange rate.
 * Returns 84 as a hardcoded fallback if the API is unavailable.
 */
async function getUsdToInrRate(): Promise<number> {
  try {
    const res = await fetch(EXCHANGE_API, { next: { revalidate: 3600 } })
    if (!res.ok) return 84
    const data = (await res.json()) as ExchangeRateResponse
    return data.rates['INR'] ?? 84
  } catch {
    return 84
  }
}

/**
 * Fetch live gold price from goldapi.io, convert to INR/gram (999 purity).
 */
async function fetchGoldPriceINR(): Promise<number | null> {
  try {
    const [goldRes, inrRate] = await Promise.all([
      fetch(`${GOLD_API_BASE}/XAU/USD`, {
        headers: { 'x-access-token': GOLD_API_KEY, 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      }),
      getUsdToInrRate(),
    ])

    if (!goldRes.ok) return null

    const gold = (await goldRes.json()) as GoldApiResponse
    const priceInrPerGram = gold.price_gram_24k * inrRate
    return Math.round(priceInrPerGram * 100) / 100
  } catch {
    return null
  }
}

/**
 * Fetch live silver price from goldapi.io, convert to INR/gram (999 purity).
 */
async function fetchSilverPriceINR(): Promise<number | null> {
  try {
    const [silverRes, inrRate] = await Promise.all([
      fetch(`${GOLD_API_BASE}/XAG/USD`, {
        headers: { 'x-access-token': GOLD_API_KEY, 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      }),
      getUsdToInrRate(),
    ])

    if (!silverRes.ok) return null

    const silver = (await silverRes.json()) as GoldApiResponse
    // Silver is quoted per troy oz. 1 troy oz = 31.1035 grams
    const pricePerGramUSD = silver.price / 31.1035
    const priceInrPerGram = pricePerGramUSD * inrRate
    return Math.round(priceInrPerGram * 100) / 100
  } catch {
    return null
  }
}

/**
 * Fetch fresh gold & silver prices from external API and upsert into Supabase.
 * Called by the cron job (daily at 9 AM IST) and optionally on-demand.
 *
 * Returns the prices that were stored.
 */
export async function fetchAndStorePrices(): Promise<{
  gold: number | null
  silver: number | null
}> {
  const supabase = createServerClient()

  const [goldPrice, silverPrice] = await Promise.all([
    fetchGoldPriceINR(),
    fetchSilverPriceINR(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserts: any[] = []

  if (goldPrice !== null) {
    inserts.push(
      supabase.from('live_prices').insert({
        metal: 'gold_999',
        price_per_gram: goldPrice,
        currency: 'INR',
        fetched_at: new Date().toISOString(),
      })
    )
  }

  if (silverPrice !== null) {
    inserts.push(
      supabase.from('live_prices').insert({
        metal: 'silver_999',
        price_per_gram: silverPrice,
        currency: 'INR',
        fetched_at: new Date().toISOString(),
      })
    )
  }

  await Promise.allSettled(inserts)

  return { gold: goldPrice, silver: silverPrice }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read latest prices
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the most recent gold + silver price from Supabase.
 * Cached for 5 minutes — prices don't change every second.
 * Use tag 'live-prices' to revalidate manually after a manual price update.
 */
export const getLatestPrices = unstable_cache(
  async (): Promise<{ gold: LivePrice | null; silver: LivePrice | null; diamond: LivePrice | null; goldPurityRates: GoldPurityRates }> => {
    const supabase = createServerClient()

    const [goldResult, silverResult, diamondResult, diamondAuditResult] = await Promise.all([
      supabase
        .from('live_prices')
        .select('*')
        .eq('metal', 'gold_999')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('live_prices')
        .select('*')
        .eq('metal', 'silver_999')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('live_prices')
        .select('*')
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

    const toLivePrice = (row: typeof goldResult['data']): LivePrice | null => {
      if (!row) return null
      return {
        id:           row.id,
        metal:        row.metal,
        pricePerGram: Number(row.price_per_gram),
        currency:     row.currency,
        fetchedAt:    row.fetched_at,
      }
    }

    const diamondFallback =
      readDiamondManualRate(diamondAuditResult.data?.meta) != null
        ? ({
            id: 'admin-audit:diamond_price_per_carat',
            metal: 'diamond_ct',
            pricePerGram: Number(readDiamondManualRate(diamondAuditResult.data?.meta)),
            currency: 'INR',
            fetchedAt: diamondAuditResult.data?.created_at ?? new Date(0).toISOString(),
          } satisfies LivePrice)
        : null
    const goldPurityRates = readGoldPurityManualRates(diamondAuditResult.data?.meta)

    return {
      gold:   toLivePrice(goldResult.data),
      silver: toLivePrice(silverResult.data),
      diamond: toLivePrice(diamondResult.data) ?? diamondFallback,
      goldPurityRates,
    }
  },
  ['latest-prices'],
  { revalidate: 300, tags: ['live-prices'] } // 5-minute cache
)

// ─────────────────────────────────────────────────────────────────────────────
// Calculate product price (server-side, for API route & SSR)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductPriceInput {
  weightGrams: number
  purity: string
  makingChargePct?: number
  gemPriceOverride?: number | null
  /** Pass pre-fetched price to avoid extra DB call */
  livePricePerGram?: number
}

/**
 * Calculate the final price for a variant.
 * If livePricePerGram is not provided, fetches latest gold price from DB.
 */
export async function calculateProductPrice(
  input: ProductPriceInput
): Promise<PriceBreakdown> {
  let livePricePerGram = input.livePricePerGram

  if (!livePricePerGram) {
    const isSilver = input.purity === '92.5'
    const { gold, silver } = await getLatestPrices()
    const latest = isSilver ? silver : gold
    livePricePerGram = latest?.pricePerGram ?? (isSilver ? 90 : 7200)
  }

  return calculateVariantPrice({
    weightGrams: input.weightGrams,
    purity: input.purity,
    livePricePerGram999: livePricePerGram,
    makingChargePct: input.makingChargePct,
    gemPriceOverride: input.gemPriceOverride,
  })
}
