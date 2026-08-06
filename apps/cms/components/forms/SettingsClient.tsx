'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Save, Loader2, CheckCircle, TrendingUp, Info } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  currentGold:     number
  currentSilver:   number
  goldUpdatedAt:   string | null
  silverUpdatedAt: string | null
  initialMakingChargePct: number
  initialAnnouncement: string
}

const PURITY_ROWS = [
  { label: '22k Gold',        purity: 0.9167, metal: 'gold'   },
  { label: '18k Gold',        purity: 0.7500, metal: 'gold'   },
  { label: '14k Gold',        purity: 0.5833, metal: 'gold'   },
  { label: 'Sterling Silver', purity: 0.925,  metal: 'silver' },
] as const

function calcPrice(rate: number, purity: number, weight = 5, making = 8) {
  const base = weight * rate * purity
  return Math.round(base + base * (making / 100))
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n)
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function SettingsClient({
  currentGold,
  currentSilver,
  goldUpdatedAt,
  silverUpdatedAt,
  initialMakingChargePct,
  initialAnnouncement,
}: Props) {
  const router = useRouter()

  // ── Price state ─────────────────────────────────────────
  const [gold,       setGold]       = useState(String(currentGold))
  const [silver,     setSilver]     = useState(String(currentSilver))
  const [saving,     setSaving]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ── Other settings state ─────────────────────────────────
  const [makingCharge,  setMakingCharge]  = useState(String(initialMakingChargePct))
  const [announcement,  setAnnouncement]  = useState(initialAnnouncement)
  const [savingOther,   setSavingOther]   = useState(false)

  const goldNum   = parseFloat(gold)   || 0
  const silverNum = parseFloat(silver) || 0
  const makingChargeNum = parseFloat(makingCharge)
  const changedGold   = goldNum   !== currentGold
  const changedSilver = silverNum !== currentSilver

  async function handleSavePrices() {
    if (goldNum <= 0 && silverNum <= 0) {
      toast.error('Enter at least one valid price')
      return
    }
    setSaving(true)
    try {
      const res  = await fetch('/api/pricing/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gold: goldNum || null, silver: silverNum || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success('Metal rates updated successfully!')
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
      if (!res.ok) throw new Error(data.error ?? 'Refresh failed')
      toast.success('Live prices fetched from market!')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'API refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  async function saveSettings() {
    if (!Number.isFinite(makingChargeNum) || makingChargeNum < 0 || makingChargeNum > 100) {
      toast.error('Enter a valid making charge between 0 and 100')
      return
    }

    setSavingOther(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ making_charge_pct: makingChargeNum, announcement }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success('Settings saved')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingOther(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Metal Rates ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-divider overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal" />
            <h3 className="font-display text-base text-deep-teal">Metal Rates</h3>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-divider text-ink-muted rounded-lg hover:border-teal hover:text-teal transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Fetching…' : 'Refresh from Market API'}
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Info */}
          <div className="flex gap-2 p-3 rounded-lg bg-teal/5 border border-teal/20 text-ink-muted text-xs">
            <Info className="h-3.5 w-3.5 text-teal shrink-0 mt-0.5" />
            Manual rates take effect immediately. All storefront product prices recalculate automatically.
          </div>

          {/* Gold + Silver inputs */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Gold */}
            <div className="border border-divider rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🪙</span>
                  <div>
                    <p className="text-sm font-medium text-ink">Gold (999 / 24k)</p>
                    <p className="text-xs text-ink-faint">Updated {timeAgo(goldUpdatedAt)}</p>
                  </div>
                </div>
                {changedGold && (
                  <span className="text-2xs px-2 py-0.5 bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-full">
                    Modified
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs text-ink-muted uppercase tracking-widest mb-1.5">
                  Rate per gram (₹)
                </label>
                <div className="flex">
                  <span className="px-3 py-2 bg-surface border border-divider border-r-0 rounded-l-lg text-ink-muted text-sm">₹</span>
                  <input
                    type="number"
                    value={gold}
                    onChange={(e) => setGold(e.target.value)}
                    min={1}
                    step={0.01}
                    placeholder="7200"
                    className="flex-1 px-3 py-2 border border-divider rounded-r-lg text-sm text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-colors"
                  />
                </div>
                <p className="text-xs text-ink-faint mt-1">
                  Live: <span className="text-ink font-medium">{formatINR(currentGold)}/g</span>
                  &nbsp;·&nbsp;
                  {formatINR(currentGold * 10)}/10g
                </p>
              </div>
            </div>

            {/* Silver */}
            <div className="border border-divider rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🥈</span>
                  <div>
                    <p className="text-sm font-medium text-ink">Silver (999)</p>
                    <p className="text-xs text-ink-faint">Updated {timeAgo(silverUpdatedAt)}</p>
                  </div>
                </div>
                {changedSilver && (
                  <span className="text-2xs px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-full">
                    Modified
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs text-ink-muted uppercase tracking-widest mb-1.5">
                  Rate per gram (₹)
                </label>
                <div className="flex">
                  <span className="px-3 py-2 bg-surface border border-divider border-r-0 rounded-l-lg text-ink-muted text-sm">₹</span>
                  <input
                    type="number"
                    value={silver}
                    onChange={(e) => setSilver(e.target.value)}
                    min={1}
                    step={0.01}
                    placeholder="90"
                    className="flex-1 px-3 py-2 border border-divider rounded-r-lg text-sm text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-colors"
                  />
                </div>
                <p className="text-xs text-ink-faint mt-1">
                  Live: <span className="text-ink font-medium">{formatINR(currentSilver)}/g</span>
                  &nbsp;·&nbsp;
                  {formatINR(currentSilver * 10)}/10g
                </p>
              </div>
            </div>
          </div>

          {/* Apply button */}
          <button
            onClick={handleSavePrices}
            disabled={saving || (!changedGold && !changedSilver)}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal text-white text-sm font-medium rounded-lg hover:bg-deep-teal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            {saving ? 'Saving…' : 'Apply Rates'}
          </button>

          {/* Price Preview */}
          <div className="rounded-lg border border-divider overflow-hidden">
            <p className="text-xs uppercase tracking-widest text-ink-muted bg-surface px-4 py-2 border-b border-divider">
              Price Preview — 5g sample · {Number.isFinite(makingChargeNum) ? makingChargeNum : 0}% making charge
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-faint border-b border-divider">
                  <th className="px-4 py-2 text-left font-normal">Purity</th>
                  <th className="px-4 py-2 text-right font-normal">Current</th>
                  <th className="px-4 py-2 text-right font-normal">New</th>
                  <th className="px-4 py-2 text-right font-normal">Diff</th>
                </tr>
              </thead>
              <tbody>
                {PURITY_ROWS.map(({ label, purity, metal }) => {
                  const liveRate = metal === 'gold' ? currentGold : currentSilver
                  const newRate  = metal === 'gold' ? goldNum      : silverNum
                  const curr     = calcPrice(liveRate, purity, 5, Number.isFinite(makingChargeNum) ? makingChargeNum : 0)
                  const next     = newRate > 0 ? calcPrice(newRate, purity, 5, Number.isFinite(makingChargeNum) ? makingChargeNum : 0) : curr
                  const diff     = next - curr
                  return (
                    <tr key={label} className="border-b border-divider last:border-0 hover:bg-surface/60 transition-colors">
                      <td className="px-4 py-2.5 text-ink">{label}</td>
                      <td className="px-4 py-2.5 text-right text-ink-muted">{formatINR(curr)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">{formatINR(next)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium text-xs ${
                        diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-ink-faint'
                      }`}>
                        {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatINR(diff)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Global Settings ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-divider p-5 space-y-4">
        <h3 className="font-display text-base text-deep-teal border-b border-divider pb-2">Global Settings</h3>

        <div className="space-y-1">
          <label className="text-xs text-ink-muted uppercase tracking-wider">Default Making Charge (%)</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={makingCharge}
              onChange={e => setMakingCharge(e.target.value)}
              min="0" max="100" step="0.5"
              className="border border-divider rounded-lg px-3 py-2 text-sm outline-none focus:border-teal w-32"
            />
            <p className="text-xs text-ink-faint">Applied to all product price calculations unless overridden per product</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-ink-muted uppercase tracking-wider">Announcement Bar Text</label>
          <input
            type="text"
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            className="w-full border border-divider rounded-lg px-3 py-2 text-sm outline-none focus:border-teal"
            placeholder="e.g. Free shipping on orders above ₹5,000 | Gold Rate Today: ₹XXXX/10g"
          />
          <p className="text-xs text-ink-faint">Shown in the top announcement bar on the storefront</p>
        </div>

        <button
          onClick={saveSettings}
          disabled={savingOther}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-lg text-sm hover:bg-deep-teal disabled:opacity-60 transition-colors"
        >
          {savingOther ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {/* ── Notification Preferences ─────────────────────── */}
      <div className="bg-white rounded-xl border border-divider p-5 space-y-4">
        <h3 className="font-display text-base text-deep-teal border-b border-divider pb-2">Realtime Notifications</h3>
        <div className="space-y-3">
          {[
            ['New Orders',             'Get notified when a customer places an order'],
            ['Callback Requests',      'Get notified when someone requests a callback'],
            ['Demo Booking Requests',  'Get notified for new demo bookings'],
            ['Customization Requests', 'Get notified for custom jewelry requests'],
            ['New Reviews',            'Get notified when a new review awaits moderation'],
          ].map(([label, desc]) => (
            <label key={label} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-teal" />
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-ink-faint">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-faint bg-surface rounded-lg p-3">
          <CheckCircle className="w-3.5 h-3.5 text-teal shrink-0" />
          Realtime powered by Atraski Tech (At-Tech). No additional setup required.
        </div>
      </div>

    </div>
  )
}
