'use client'

import { useState } from 'react'
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
}

const PURITY_ROWS = [
  { label: '22k Gold',        purity: 0.9167, metal: 'gold'   },
  { label: '18k Gold',        purity: 0.7500, metal: 'gold'   },
  { label: '14k Gold',        purity: 0.5833, metal: 'gold'   },
  { label: 'Sterling Silver', purity: 0.925,  metal: 'silver' },
] as const

function calcPrice(pricePerGram: number, purity: number, weight = 5, makingPct = 8) {
  const base    = weight * pricePerGram * purity
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
}: Props) {
  const router = useRouter()

  const [gold,   setGold]   = useState<string>(String(currentGold))
  const [silver, setSilver] = useState<string>(String(currentSilver))
  const [diamond, setDiamond] = useState<string>(currentDiamond > 0 ? String(currentDiamond) : '')
  const [saving,     setSaving]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const goldNum   = parseFloat(gold)   || 0
  const silverNum = parseFloat(silver) || 0
  const diamondNum = parseFloat(diamond) || 0

  async function handleSave() {
    if (goldNum <= 0 && silverNum <= 0 && diamondNum <= 0) {
      toast.error('Enter at least one valid price')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/pricing/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gold: goldNum || null, silver: silverNum || null, diamond: diamondNum || null }),
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
            Manually set gold, silver, and diamond cut rates. All product prices recalculate instantly.
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
        Manual rates override live API. The new rate becomes effective immediately across the storefront.
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

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || (!changedGold && !changedSilver && !changedDiamond)}
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
            {PURITY_ROWS.map(({ label, purity, metal }) => {
              const livePrice = metal === 'gold' ? currentGold : currentSilver
              const newPrice  = metal === 'gold' ? goldNum      : silverNum
              const current   = calcPrice(livePrice, purity)
              const updated   = newPrice > 0 ? calcPrice(newPrice, purity) : current
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
          * Preview assumes 5g weight, purity multiplier applied, 8% making charge. Diamond pricing uses the cut/ct rate set above at product calculation time.
        </p>
      </div>
    </div>
  )
}
