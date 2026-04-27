'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Copy, Check, Tag, Loader2, X, AlertCircle,
  Calendar, IndianRupee, Percent, Users, ShoppingCart,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type AppliesTo = 'making_charge' | 'gem_price' | 'both'

interface Coupon {
  id:                  string
  code:                string
  description:         string | null
  type:                'percentage' | 'fixed'
  value:               number
  applies_to:          AppliesTo
  min_order_amount:    number
  max_discount_amount: number | null
  usage_limit:         number | null
  used_count:          number
  expires_at:          string | null
  is_active:           boolean
  created_at:          string
}

interface FormState {
  code:                string
  description:         string
  type:                'percentage' | 'fixed'
  value:               string
  applies_to:          AppliesTo
  min_order_amount:    string
  max_discount_amount: string
  usage_limit:         string
  expires_at:          string
  is_active:           boolean
}

const APPLIES_TO_LABELS: Record<AppliesTo, string> = {
  making_charge: 'Making Charges only',
  gem_price:     'Stone / Gem Price only',
  both:          'Making Charges + Stone Price',
}

const EMPTY_FORM: FormState = {
  code:                '',
  description:         '',
  type:                'percentage',
  value:               '',
  applies_to:          'both',
  min_order_amount:    '',
  max_discount_amount: '',
  usage_limit:         '',
  expires_at:          '',
  is_active:           true,
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CouponsClient({ initial }: { initial: Coupon[] }) {
  const [coupons,    setCoupons]    = useState<Coupon[]>(initial)
  const [modal,      setModal]      = useState(false)
  const [editing,    setEditing]    = useState<Coupon | null>(null)
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM)
  const [error,      setError]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [copiedId,   setCopiedId]   = useState<string | null>(null)
  const [filter,     setFilter]     = useState<'all' | 'active' | 'inactive' | 'expired'>('all')
  const [, startT]                  = useTransition()

  const now = new Date()

  // ── Filtered list ────────────────────────────────────────────────────────
  const displayed = coupons.filter(c => {
    const expired = c.expires_at ? new Date(c.expires_at) < now : false
    if (filter === 'active')   return c.is_active && !expired
    if (filter === 'inactive') return !c.is_active
    if (filter === 'expired')  return expired
    return true
  })

  // ── Open modal ───────────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setModal(true)
  }
  function openEdit(c: Coupon) {
    setEditing(c)
    setForm({
      code:                c.code,
      description:         c.description ?? '',
      type:                c.type,
      value:               String(c.value),
      applies_to:          c.applies_to ?? 'both',
      min_order_amount:    String(c.min_order_amount),
      max_discount_amount: c.max_discount_amount != null ? String(c.max_discount_amount) : '',
      usage_limit:         c.usage_limit != null ? String(c.usage_limit) : '',
      expires_at:          c.expires_at ? c.expires_at.slice(0, 10) : '',
      is_active:           c.is_active,
    })
    setError('')
    setModal(true)
  }

  // ── Save (create / update) ────────────────────────────────────────────────
  async function handleSave() {
    if (!form.code.trim()) { setError('Coupon code is required'); return }
    if (!form.value)       { setError('Value is required');       return }
    if (form.type === 'percentage' && Number(form.value) > 100) {
      setError('Percentage cannot exceed 100')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      code:                form.code,
      description:         form.description || null,
      type:                form.type,
      value:               form.value,
      applies_to:          form.applies_to,
      min_order_amount:    form.min_order_amount || 0,
      max_discount_amount: form.max_discount_amount || null,
      usage_limit:         form.usage_limit || null,
      expires_at:          form.expires_at || null,
      is_active:           form.is_active,
    }

    const url    = editing ? `/api/coupons/${editing.id}` : '/api/coupons'
    const method = editing ? 'PATCH' : 'POST'

    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }

    startT(() => {
      if (editing) {
        setCoupons(prev => prev.map(c => c.id === editing.id ? json.data : c))
      } else {
        setCoupons(prev => [json.data, ...prev])
      }
    })
    setModal(false)
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  async function toggleActive(c: Coupon) {
    const res  = await fetch(`/api/coupons/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    })
    if (res.ok) {
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Delete this coupon? This cannot be undone.')) return
    setDeleting(id)
    const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) setCoupons(prev => prev.filter(c => c.id !== id))
  }

  // ── Copy code ─────────────────────────────────────────────────────────────
  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total:    coupons.length,
    active:   coupons.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) >= now)).length,
    inactive: coupons.filter(c => !c.is_active).length,
    expired:  coupons.filter(c => c.expires_at && new Date(c.expires_at) < now).length,
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage discount coupons</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white text-sm rounded-lg hover:bg-teal transition-colors">
          <Plus className="h-4 w-4" /> New Coupon
        </button>
      </div>

      {/* ── Stats cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',    value: stats.total,    color: 'bg-blue-50 text-blue-700',   border: 'border-blue-200'   },
          { label: 'Active',   value: stats.active,   color: 'bg-green-50 text-green-700', border: 'border-green-200'  },
          { label: 'Inactive', value: stats.inactive, color: 'bg-gray-50 text-gray-600',   border: 'border-gray-200'   },
          { label: 'Expired',  value: stats.expired,  color: 'bg-red-50 text-red-600',     border: 'border-red-200'    },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.border} ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium uppercase tracking-wide mt-0.5 opacity-75">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {(['all', 'active', 'inactive', 'expired'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pb-2.5 px-1 text-sm font-medium capitalize border-b-2 transition-colors ${
              filter === f
                ? 'border-deep-teal text-deep-teal'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No coupons found</p>
          <button onClick={openCreate} className="mt-3 text-sm text-deep-teal hover:underline">
            Create your first coupon →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Code</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Type / Value</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Applies To</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Usage</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Expires</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Status</th>
                <th className="px-4 py3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map(c => {
                const expired = c.expires_at ? new Date(c.expires_at) < now : false
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    {/* Code */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs tracking-widest">
                          {c.code}
                        </span>
                        <button
                          onClick={() => copyCode(c.code, c.id)}
                          className="text-gray-400 hover:text-deep-teal transition-colors"
                          title="Copy code"
                        >
                          {copiedId === c.id
                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {c.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{c.description}</p>
                      )}
                    </td>

                    {/* Type / Value */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {c.type === 'percentage'
                          ? <Percent className="h-3.5 w-3.5 text-purple-500" />
                          : <IndianRupee className="h-3.5 w-3.5 text-green-500" />}
                        <span className="font-semibold text-gray-900">
                          {c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`}
                        </span>
                      </div>
                      {c.type === 'percentage' && c.max_discount_amount && (
                        <p className="text-xs text-gray-400 mt-0.5">Max ₹{c.max_discount_amount}</p>
                      )}
                    </td>

                    {/* Applies To */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        c.applies_to === 'making_charge'
                          ? 'bg-amber-50 text-amber-700'
                          : c.applies_to === 'gem_price'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-teal/10 text-teal'
                      }`}>
                        {APPLIES_TO_LABELS[c.applies_to ?? 'both']}
                      </span>
                      {c.min_order_amount > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">Min ₹{c.min_order_amount}</p>
                      )}
                    </td>

                    {/* Usage */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        <span>{c.used_count}</span>
                        <span className="text-gray-300">/</span>
                        <span>{c.usage_limit ?? '∞'}</span>
                      </div>
                      {c.usage_limit && (
                        <div className="mt-1 h-1 w-20 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal rounded-full"
                            style={{ width: `${Math.min(100, (c.used_count / c.usage_limit) * 100)}%` }}
                          />
                        </div>
                      )}
                    </td>

                    {/* Expires */}
                    <td className="px-4 py-3">
                      {c.expires_at ? (
                        <div className={`flex items-center gap-1 text-xs ${expired ? 'text-red-500' : 'text-gray-600'}`}>
                          <Calendar className="h-3 w-3" />
                          {new Date(c.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {expired && <span className="ml-1 font-medium">(Expired)</span>}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">Never</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'}>
                        {c.is_active
                          ? <ToggleRight className="h-6 w-6 text-teal" />
                          : <ToggleLeft className="h-6 w-6 text-gray-300" />}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-deep-teal transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deleting === c.id}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          {deleting === c.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Coupon' : 'New Coupon'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Code */}
              <div>
                <label className={lbl}>Coupon Code <span className="text-red-500">*</span></label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. WELCOME20"
                  className={`${inp} font-mono tracking-widest`}
                />
                <p className="text-xs text-gray-400 mt-1">Auto-uppercased. Letters, numbers, hyphens only.</p>
              </div>

              {/* Description */}
              <div>
                <label className={lbl}>Description <span className="text-gray-400">(optional)</span></label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Welcome discount for new users"
                  className={inp}
                />
              </div>

              {/* Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Type <span className="text-red-500">*</span></label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'fixed' }))}
                    className={inp}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>
                    {form.type === 'percentage' ? 'Discount %' : 'Discount ₹'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.type === 'percentage' ? 100 : undefined}
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={form.type === 'percentage' ? '20' : '200'}
                    className={inp}
                  />
                </div>
              </div>

              {/* Applies To */}
              <div>
                <label className={lbl}>Discount Applies To <span className="text-red-500">*</span></label>
                <select
                  value={form.applies_to}
                  onChange={e => setForm(f => ({ ...f, applies_to: e.target.value as AppliesTo }))}
                  className={inp}
                >
                  <option value="both">Making Charges + Stone / Gem Price</option>
                  <option value="making_charge">Making Charges only</option>
                  <option value="gem_price">Stone / Gem Price only</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Discount is applied on these components only — never on metal price.
                </p>
              </div>

              {/* Max discount (percentage only) */}
              {form.type === 'percentage' && (
                <div>
                  <label className={lbl}>Max Discount ₹ <span className="text-gray-400">(optional cap)</span></label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_discount_amount}
                    onChange={e => setForm(f => ({ ...f, max_discount_amount: e.target.value }))}
                    placeholder="e.g. 500"
                    className={inp}
                  />
                </div>
              )}

              {/* Min order + Usage limit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Min Order ₹</label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_order_amount}
                    onChange={e => setForm(f => ({ ...f, min_order_amount: e.target.value }))}
                    placeholder="0"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Usage Limit <span className="text-gray-400">(blank = ∞)</span></label>
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))}
                    placeholder="Unlimited"
                    className={inp}
                  />
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className={lbl}>Expiry Date <span className="text-gray-400">(blank = never expires)</span></label>
                <input
                  type="date"
                  value={form.expires_at}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className={inp}
                />
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-teal' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">Active (usable on checkout)</span>
              </label>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-deep-teal text-white rounded-lg hover:bg-teal disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = 'block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5'
const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors bg-white'
