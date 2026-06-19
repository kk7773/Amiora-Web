'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Search, X, ChevronRight, Package, Loader2, Truck, ExternalLink } from 'lucide-react'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']

interface OrderItem {
  id: string; quantity: number; unit_price: number; variant_label?: string
  product?: { name: string; slug: string; images?: { url: string; is_primary: boolean }[] }
}
interface Order {
  id: string; order_number: string; total_amount: number; status: string
  discount_amount?: number; coupon_code?: string | null
  payment_mode?: string; created_at: string; shipping_address?: Record<string, string>
  pickup_store_id?: string
  awb_code?: string | null
  courier_name?: string | null
  tracking_url?: string | null
  user?: { full_name?: string; phone?: string } | null
  items?: OrderItem[]
}

function canCreateShipment(order: Order) {
  return (
    Boolean(order.shipping_address) &&
    !order.pickup_store_id &&
    !order.awb_code &&
    (order.status === 'confirmed' || order.status === 'processing')
  )
}

export function OrdersClient({ orders: initial, stores }: { orders: Order[]; stores: { id: string; name: string }[] }) {
  const [orders, setOrders] = useState(initial)
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving]   = useState(false)
  const [shipping, setShipping] = useState(false)

  const filtered = orders.filter(o => {
    if (search && !o.order_number.includes(search) && !o.user?.full_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && o.status !== filterStatus) return false
    return true
  })

  async function updateStatus() {
    if (!selected || !newStatus) return
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      setOrders(os => os.map(o => o.id === selected.id ? { ...o, status: newStatus } : o))
      setSelected(o => o ? { ...o, status: newStatus } : null)
      toast.success('Status updated')
    } catch { toast.error('Failed to update') } finally { setSaving(false) }
  }

  async function createShipment() {
    if (!selected) return
    setShipping(true)
    try {
      const res = await fetch(`/api/orders/${selected.id}/shiprocket`, { method: 'POST' })
      const data = (await res.json()) as {
        awb_code?: string
        courier_name?: string
        tracking_url?: string
        error?: string
        already_created?: boolean
      }
      if (!res.ok) throw new Error(data.error ?? 'Shipment creation failed')

      const patch = {
        awb_code: data.awb_code ?? null,
        courier_name: data.courier_name ?? null,
        tracking_url: data.tracking_url ?? null,
        status: selected.status === 'confirmed' ? 'processing' : selected.status,
      }

      setOrders((os) => os.map((o) => (o.id === selected.id ? { ...o, ...patch } : o)))
      setSelected((o) => (o ? { ...o, ...patch } : null))
      setNewStatus(patch.status)

      toast.success(
        data.already_created
          ? 'Shipment already exists'
          : `AWB assigned: ${data.awb_code}`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create shipment')
    } finally {
      setShipping(false)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-divider rounded-lg px-3 py-2 flex-1">
          <Search className="w-3.5 h-3.5 text-ink-faint" />
          <input placeholder="Search order # or customer…" value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent outline-none text-sm flex-1 placeholder:text-ink-faint" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white border border-divider rounded-lg px-3 py-2 text-sm outline-none text-ink-muted">
          <option value="">All Statuses</option>
          {STATUS_STEPS.concat(['cancelled', 'booked_for_pickup']).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-divider overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-divider bg-surface">
              {['Order #','Customer','Date','Items','Total','Payment','Status',''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs text-ink-faint font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-divider">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-surface/50 cursor-pointer" onClick={() => { setSelected(o); setNewStatus(o.status) }}>
                  <td className="px-5 py-3 font-mono text-xs text-teal">{o.order_number}</td>
                  <td className="px-5 py-3 font-medium">{o.user?.full_name ?? 'Guest'}</td>
                  <td className="px-5 py-3 text-ink-muted text-xs">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-ink-muted">{o.items?.length ?? 0}</td>
                  <td className="px-5 py-3 font-medium">₹{o.total_amount?.toLocaleString()}</td>
                  <td className="px-5 py-3"><Badge variant="info">{o.payment_mode ?? 'online'}</Badge></td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3"><ChevronRight className="w-4 h-4 text-ink-faint" /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-ink-faint">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-divider flex items-center justify-between">
              <h3 className="font-display text-lg text-deep-teal">Order {selected.order_number}</h3>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-ink-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Status Timeline */}
              <div>
                <p className="text-xs text-ink-faint uppercase tracking-wider mb-3">Status Timeline</p>
                <div className="flex items-center gap-1">
                  {STATUS_STEPS.map((s, i) => {
                    const idx = STATUS_STEPS.indexOf(selected.status)
                    const done = i <= idx
                    return (
                      <div key={s} className="flex items-center flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${done ? 'bg-teal text-white' : 'bg-surface border-2 border-divider text-ink-faint'}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 mx-1">
                          <div className={`h-0.5 ${done && i < STATUS_STEPS.length - 1 ? 'bg-teal' : 'bg-divider'}`} />
                        </div>
                        <p className="hidden sm:block text-[10px] text-ink-faint capitalize absolute">{s}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {STATUS_STEPS.map(s => <p key={s} className="text-[10px] text-ink-faint capitalize flex-1 text-center">{s}</p>)}
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs text-ink-faint uppercase tracking-wider mb-3">Order Items</p>
                <div className="space-y-2">
                  {selected.items?.map(item => {
                    const img = item.product?.images?.find(i => i.is_primary) ?? item.product?.images?.[0]
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                        {img && <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-surface-2 shrink-0">
                          <Image src={img.url} alt={item.product?.name ?? ''} fill className="object-cover" sizes="48px" />
                        </div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{item.product?.name}</p>
                          <p className="text-xs text-ink-muted">{item.variant_label} · Qty {item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-ink">₹{(item.unit_price * item.quantity).toLocaleString()}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-divider space-y-1">
                  {selected.discount_amount != null && selected.discount_amount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-muted">Coupon {selected.coupon_code ? `(${selected.coupon_code})` : ''}</span>
                      <span className="text-teal">−₹{selected.discount_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-muted">Total</span>
                    <span className="font-display text-lg font-medium text-deep-teal">₹{selected.total_amount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Info */}
              <div>
                <p className="text-xs text-ink-faint uppercase tracking-wider mb-2">Delivery Info</p>
                {selected.shipping_address ? (
                  <div className="text-sm text-ink bg-surface rounded-lg p-3 space-y-1">
                    <p>{selected.shipping_address.line1}{selected.shipping_address.line2 && `, ${selected.shipping_address.line2}`}</p>
                    <p>
                      {selected.shipping_address.city}
                      {selected.shipping_address.district && `, ${selected.shipping_address.district}`}
                      {`, ${selected.shipping_address.state}`} — {selected.shipping_address.pincode}
                    </p>
                  </div>
                ) : selected.pickup_store_id ? (
                  <p className="text-sm text-ink bg-surface rounded-lg p-3">
                    <Package className="inline w-4 h-4 mr-1 text-teal" />
                    Pickup from store
                  </p>
                ) : null}
              </div>

              {/* Shiprocket */}
              {selected.shipping_address && !selected.pickup_store_id && (
                <div className="bg-surface rounded-lg p-4 space-y-3">
                  <p className="text-xs text-ink-faint uppercase tracking-wider">Shiprocket</p>
                  {selected.awb_code ? (
                    <div className="space-y-2 text-sm">
                      <p><span className="text-ink-muted">AWB:</span> <span className="font-mono text-teal">{selected.awb_code}</span></p>
                      {selected.courier_name && (
                        <p><span className="text-ink-muted">Courier:</span> {selected.courier_name}</p>
                      )}
                      {(selected.tracking_url ?? selected.awb_code) && (
                        <a
                          href={selected.tracking_url ?? `https://shiprocket.co/tracking/${selected.awb_code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-teal hover:text-deep-teal text-sm font-medium"
                        >
                          Track shipment <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ) : canCreateShipment(selected) ? (
                    <button
                      type="button"
                      onClick={createShipment}
                      disabled={shipping}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-deep-teal text-white rounded-lg text-sm hover:bg-teal disabled:opacity-60"
                    >
                      {shipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                      Create Shiprocket Shipment
                    </button>
                  ) : (
                    <p className="text-xs text-ink-muted">Shipment available when order is confirmed or processing.</p>
                  )}
                </div>
              )}

              {/* Update Status */}
              <div className="bg-surface rounded-lg p-4 flex items-center gap-3">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="border border-divider rounded-lg px-3 py-2 text-sm outline-none focus:border-teal bg-white flex-1">
                  {STATUS_STEPS.concat(['cancelled']).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
                <button onClick={updateStatus} disabled={saving || newStatus === selected.status} className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-lg text-sm hover:bg-deep-teal disabled:opacity-60">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
