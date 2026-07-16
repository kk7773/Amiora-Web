'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TrendingUp, RefreshCw, Save, Info } from 'lucide-react'

interface Props {
  currentGold:    number
  currentSilver:  number
  currentDiamond: number
  goldUpdatedAt:  string | null
  silverUpdatedAt: string | null
  diamondUpdatedAt: string | null
  goldPurityRates: {
    '09': number | null
    '14': number | null
    '18': number | null
    '22': number | null
  }
}

const PURITY_ROWS = [
  { key: '22', label: '22k Gold', purity: 22 / 24, metal: 'gold' },
  { key: '18', label: '18k Gold', purity: 18 / 24, metal: 'gold' },
  { key: '14', label: '14k Gold', purity: 14 / 24, metal: 'gold' },
  { key: '09', label: '9k Gold', purity: 9 / 24, metal: 'gold' },
  { key: 'silver', label: 'Sterling Silver', purity: 0.925, metal: 'silver' },
] as const

const GOLD_PURITY_KEYS = ['22', '18', '14', '09'] as const

function calcPrice(ratePerGram: number, weight = 5, makingPct = 8) {
  const base    = weight * ratePerGram
  const making  = base * (makingPct / 100)
  return Math.round(base + making)
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function PricingClient({
  currentGold,
  currentSilver,
  currentDiamond,
  goldUpdatedAt,
  silverUpdatedAt,
  diamondUpdatedAt,
  goldPurityRates,
}: Props) {
  const router = useRouter()

  const [gold,   setGold]   = useState<string>(String(currentGold))
  const [silver, setSilver] = useState<string>(String(currentSilver))
  const [diamond, setDiamond] = useState<string>(currentDiamond > 0 ? String(currentDiamond) : '')
  const [goldByPurity, setGoldByPurity] = useState<Record<(typeof GOLD_PURITY_KEYS)[number], string>>({
    '22': goldPurityRates['22'] != null ? String(goldPurityRates['22']) : String(Math.round(currentGold * (22 / 24) * 100) / 100),
    '18': goldPurityRates['18'] != null ? String(goldPurityRates['18']) : String(Math.round(currentGold * (18 / 24) * 100) / 100),
    '14': goldPurityRates['14'] != null ? String(goldPurityRates['14']) : String(Math.round(currentGold * (14 / 24) * 100) / 100),
    '09': goldPurityRates['09'] != null ? String(goldPurityRates['09']) : String(Math.round(currentGold * (9 / 24) * 100) / 100),
  })
  const [saving,     setSaving]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const goldNum   = parseFloat(gold)   || 0
  const silverNum = parseFloat(silver) || 0
  const diamondNum = parseFloat(diamond) || 0
  const normalizedGoldPurityRates = useMemo(
    () =>
      Object.fromEntries(
        GOLD_PURITY_KEYS.map((key) => {
          const parsed = parseFloat((goldByPurity[key] ?? '').trim())
          return [key, Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null]
        }),
      ) as Record<(typeof GOLD_PURITY_KEYS)[number], number | null>,
    [goldByPurity],
  )

  async function handleSave() {
    const hasGoldPurityRate = Object.values(normalizedGoldPurityRates).some((value) => value != null && value > 0)
    if (goldNum <= 0 && silverNum <= 0 && diamondNum <= 0 && !hasGoldPurityRate) {
      toast.error('Enter at least one valid price')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/pricing/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gold: goldNum || null,
          silver: silverNum || null,
          diamond: diamondNum || null,
          goldPurityRates: normalizedGoldPurityRates,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success('Prices updated successfully!')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res  = await fetch('/api/pricing/refresh', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success('Live prices refreshed from market!')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'API refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const changedGold   = goldNum   !== currentGold
  const changedSilver = silverNum !== currentSilver
  const changedDiamond = diamondNum !== currentDiamond
  const changedGoldPurity = GOLD_PURITY_KEYS.some((key) => normalizedGoldPurityRates[key] !== goldPurityRates[key])

  return (
    <div className="p-6 space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5 text-teal" />
            <h1 className="font-display text-2xl text-cream">Pricing Control</h1>
          </div>
          <p className="text-sidebar-text text-sm">
            Manually set base metal rates aur gold purity-wise rates. Storefront pricing turant recalculate hoga.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-white/20 text-sidebar-text rounded-lg hover:border-teal hover:text-teal transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh from Live API'}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex gap-2 p-3 rounded-lg bg-teal/10 border border-teal/20 text-sidebar-text text-xs">
        <Info className="h-3.5 w-3.5 text-teal shrink-0 mt-0.5" />
        Gold 9k / 14k / 18k / 22k rates yahan se alag set kar sakte ho. Agar blank chhoda, system 999 gold rate se purity multiplier derive karega.
      </div>

      {/* Rate inputs */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Gold */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-base">🪙</div>
              <div>
                <p className="text-cream font-medium text-sm">Gold (999 purity)</p>
                <p className="text-sidebar-text text-xs">Updated {timeAgo(goldUpdatedAt)}</p>
              </div>
            </div>
            {changedGold && (
              <span className="text-2xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">Modified</span>
            )}
          </div>

          <div>
            <label className="block text-xs text-sidebar-text uppercase tracking-widest mb-1.5">
              Rate (₹ per gram)
            </label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2.5 bg-white/10 border border-white/20 border-r-0 rounded-l-lg text-sidebar-text text-sm">₹</span>
              <input
                type="number"
                value={gold}
                onChange={(e) => setGold(e.target.value)}
                min={1}
                step={0.01}
                placeholder="7200"
                className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-r-lg text-cream text-sm outline-none focus:border-teal transition-colors"
              />
            </div>
            <p className="text-xs text-sidebar-text mt-1.5">
              Current: <span className="text-cream">{formatINR(currentGold)}/g</span>
            </p>
          </div>
        </div>

        {/* Silver */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center text-base">🥈</div>
              <div>
                <p className="text-cream font-medium text-sm">Silver (999 purity)</p>
                <p className="text-sidebar-text text-xs">Updated {timeAgo(silverUpdatedAt)}</p>
              </div>
            </div>
            {changedSilver && (
              <span className="text-2xs px-2 py-0.5 bg-slate-400/20 text-slate-300 rounded-full">Modified</span>
            )}
          </div>

          <div>
            <label className="block text-xs text-sidebar-text uppercase tracking-widest mb-1.5">
              Rate (₹ per gram)
            </label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2.5 bg-white/10 border border-white/20 border-r-0 rounded-l-lg text-sidebar-text text-sm">₹</span>
              <input
                type="number"
                value={silver}
                onChange={(e) => setSilver(e.target.value)}
                min={1}
                step={0.01}
                placeholder="90"
                className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-r-lg text-cream text-sm outline-none focus:border-teal transition-colors"
              />
            </div>
            <p className="text-xs text-sidebar-text mt-1.5">
              Current: <span className="text-cream">{formatINR(currentSilver)}/g</span>
            </p>
          </div>
        </div>

        {/* Diamond */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-cyan-400/20 flex items-center justify-center text-base">💎</div>
              <div>
                <p className="text-cream font-medium text-sm">Diamond (cut basis)</p>
                <p className="text-sidebar-text text-xs">Updated {timeAgo(diamondUpdatedAt)}</p>
              </div>
            </div>
            {changedDiamond && (
              <span className="text-2xs px-2 py-0.5 bg-cyan-400/20 text-cyan-300 rounded-full">Modified</span>
            )}
          </div>

          <div>
            <label className="block text-xs text-sidebar-text uppercase tracking-widest mb-1.5">
              Rate (₹ per ct)
            </label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2.5 bg-white/10 border border-white/20 border-r-0 rounded-l-lg text-sidebar-text text-sm">₹</span>
              <input
                type="number"
                value={diamond}
                onChange={(e) => setDiamond(e.target.value)}
                min={0}
                step={0.01}
                placeholder="50000"
                className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-r-lg text-cream text-sm outline-none focus:border-teal transition-colors"
              />
            </div>
            <p className="text-xs text-sidebar-text mt-1.5">
              Current: <span className="text-cream">{currentDiamond > 0 ? `${formatINR(currentDiamond)}/ct` : 'Not set'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-cream text-sm font-medium">Gold Purity Rate Control</h2>
          <p className="text-sidebar-text text-xs mt-1">
            In rates ko per-gram purity rate samjha jayega. Gold products me matching purity ke liye yahi rate use hoga.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {GOLD_PURITY_KEYS.map((key) => {
            const label = key === '09' ? '9k Gold' : `${Number(key)}k Gold`
            const multiplier = key === '22' ? 22 / 24 : key === '18' ? 18 / 24 : key === '14' ? 14 / 24 : 9 / 24
            const fallbackRate = Math.round(currentGold * multiplier * 100) / 100
            const currentRate = goldPurityRates[key] ?? fallbackRate
            const nextRate = normalizedGoldPurityRates[key] ?? 0
            const changed = nextRate !== currentRate

            return (
              <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-cream font-medium text-sm">{label}</p>
                    <p className="text-sidebar-text text-xs">Current: {formatINR(currentRate)}/g</p>
                  </div>
                  {changed && (
                    <span className="text-2xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">Modified</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-sidebar-text uppercase tracking-widest mb-1.5">
                    Rate (₹ per gram)
                  </label>
                  <div className="flex items-center gap-0">
                    <span className="px-3 py-2.5 bg-white/10 border border-white/20 border-r-0 rounded-l-lg text-sidebar-text text-sm">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={goldByPurity[key]}
                      onChange={(e) => setGoldByPurity((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={String(fallbackRate)}
                      className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-r-lg text-cream text-sm outline-none focus:border-teal transition-colors"
                    />
                  </div>
                  <p className="text-xs text-sidebar-text mt-1.5">
                    Fallback from 999 gold: <span className="text-cream">{formatINR(fallbackRate)}/g</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || (!changedGold && !changedSilver && !changedDiamond && !changedGoldPurity)}
        className="flex items-center gap-2 px-6 py-3 bg-teal text-white text-sm font-medium rounded-lg hover:bg-sidebar-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Saving…' : 'Apply Manual Rates'}
      </button>

      {/* Price Preview Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-teal" />
          <h2 className="text-cream text-sm font-medium">Price Preview — 5g sample (8% making charge)</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-sidebar-text border-b border-white/10">
              <th className="px-5 py-3 text-left">Metal / Purity</th>
              <th className="px-5 py-3 text-right">Current Rate</th>
              <th className="px-5 py-3 text-right">New Rate</th>
              <th className="px-5 py-3 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            {PURITY_ROWS.map(({ key, label, purity, metal }) => {
              const currentRate =
                metal === 'gold'
                  ? (key === '22'
                      ? goldPurityRates['22'] ?? Math.round(currentGold * purity * 100) / 100
                      : key === '18'
                        ? goldPurityRates['18'] ?? Math.round(currentGold * purity * 100) / 100
                        : key === '14'
                          ? goldPurityRates['14'] ?? Math.round(currentGold * purity * 100) / 100
                          : key === '09'
                            ? goldPurityRates['09'] ?? Math.round(currentGold * purity * 100) / 100
                            : currentGold)
                  : Math.round(currentSilver * purity * 100) / 100
              const nextRate =
                metal === 'gold'
                  ? (key === '22'
                      ? normalizedGoldPurityRates['22'] ?? currentRate
                      : key === '18'
                        ? normalizedGoldPurityRates['18'] ?? currentRate
                        : key === '14'
                          ? normalizedGoldPurityRates['14'] ?? currentRate
                          : normalizedGoldPurityRates['09'] ?? currentRate)
                  : (silverNum > 0 ? Math.round(silverNum * purity * 100) / 100 : currentRate)
              const current   = calcPrice(currentRate)
              const updated   = calcPrice(nextRate)
              const diff      = updated - current
              return (
                <tr key={label} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 text-cream">{label}</td>
                  <td className="px-5 py-3 text-right text-sidebar-text">{formatINR(current)}</td>
                  <td className="px-5 py-3 text-right text-cream">{formatINR(updated)}</td>
                  <td className={`px-5 py-3 text-right font-medium ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-sidebar-text'}`}>
                    {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatINR(diff)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-2xs text-sidebar-text px-5 py-2.5">
          * Preview assumes 5g gross weight and 8% making charge. Gold rows use purity-specific per-gram rates set above.
        </p>
      </div>
    </div>
  )
}
