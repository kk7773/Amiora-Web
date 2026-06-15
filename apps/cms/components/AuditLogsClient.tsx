'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  ExternalLink,
  Pencil,
  Sparkles,
} from 'lucide-react'
import { formatMetaEntries, type AuditLink, type ResourceSnapshot } from '@/lib/auditLogTypes'

interface AuditLog {
  id: string
  action: string
  resource: string | null
  resource_id: string | null
  meta: Record<string, unknown> | null
  created_at: string
  admin_id?: string | null
  profiles: { full_name: string | null } | null
}

type LogDetail = {
  log: AuditLog
  links: AuditLink[]
  snapshot: ResourceSnapshot | null
  snapshotMissing: boolean
}

const LIMIT = 30

const FILTER_CHIPS = [
  { value: '', label: 'All' },
  { value: 'products', label: 'Products' },
  { value: 'orders', label: 'Orders' },
  { value: 'collections', label: 'Collections' },
  { value: 'admin-management', label: 'Admin' },
  { value: 'blogs', label: 'Blogs' },
] as const

const ACTION_LABELS: Record<string, string> = {
  create_admin: 'Created a new admin',
  delete_admin: 'Removed an admin',
  update_permissions: 'Changed admin tab access',
  disable_admin: 'Disabled an admin account',
  enable_admin: 'Re-enabled an admin account',
  reset_admin_password: 'Reset an admin password',
  update_admin_name: 'Updated admin name',
  create_product: 'Added a new product',
  update_product: 'Edited a product',
  delete_product: 'Deleted a product',
  bulk_import_products: 'Bulk imported products',
  create_blog: 'Published a blog post',
  update_blog: 'Edited a blog post',
  delete_blog: 'Deleted a blog post',
  create_collection: 'Created a collection',
  update_collection: 'Edited a collection',
  delete_collection: 'Deleted a collection',
  create_category: 'Created a category',
  update_category: 'Edited a category',
  delete_category: 'Deleted a category',
  create_coupon: 'Created a coupon',
  update_coupon: 'Edited a coupon',
  delete_coupon: 'Deleted a coupon',
  create_faq: 'Added an FAQ',
  update_faq: 'Edited an FAQ',
  delete_faq: 'Deleted an FAQ',
  create_store: 'Added a store',
  update_store: 'Edited a store',
  delete_store: 'Deleted a store',
  create_testimonial: 'Added a testimonial',
  update_testimonial: 'Edited a testimonial',
  delete_testimonial: 'Deleted a testimonial',
  create_tag: 'Created a product tag',
  update_tag: 'Edited a product tag',
  delete_tag: 'Deleted a product tag',
  update_order: 'Updated an order',
  update_review: 'Moderated a review',
  update_request: 'Handled a customer request',
  update_settings: 'Changed site settings',
  refresh_pricing: 'Refreshed gold/silver rates',
  update_pricing_manual: 'Updated manual pricing',
}

const RESOURCE_LABELS: Record<string, string> = {
  products: 'Products',
  orders: 'Orders',
  'admin-management': 'Admin',
  collections: 'Collections',
  blogs: 'Blogs',
  reviews: 'Reviews',
  coupons: 'Coupons',
  faqs: 'FAQs',
  stores: 'Stores',
  testimonials: 'Testimonials',
  requests: 'Requests',
  pricing: 'Pricing',
  settings: 'Settings',
}

type ActionTone = 'create' | 'update' | 'delete' | 'bulk' | 'admin' | 'default'

function actionTone(action: string): ActionTone {
  if (action.startsWith('create_')) return 'create'
  if (action.startsWith('delete_') || action.startsWith('disable_')) return 'delete'
  if (action.includes('bulk')) return 'bulk'
  if (action.includes('admin') || action.includes('permission')) return 'admin'
  if (action.startsWith('update_') || action.startsWith('enable_') || action.startsWith('refresh_')) return 'update'
  return 'default'
}

const TONE_STYLES: Record<ActionTone, { dot: string; badge: string; ring: string }> = {
  create: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-800 border-emerald-100', ring: 'ring-emerald-200' },
  update: { dot: 'bg-sky-500', badge: 'bg-sky-50 text-sky-800 border-sky-100', ring: 'ring-sky-200' },
  delete: { dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-800 border-rose-100', ring: 'ring-rose-200' },
  bulk: { dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-800 border-violet-100', ring: 'ring-violet-200' },
  admin: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-900 border-amber-100', ring: 'ring-amber-200' },
  default: { dot: 'bg-teal', badge: 'bg-surface text-ink-muted border-divider', ring: 'ring-divider' },
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'S'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  let relative = 'Just now'
  if (diffMins >= 1 && diffMins < 60) relative = `${diffMins}m ago`
  else if (diffHours >= 1 && diffHours < 24) relative = `${diffHours}h ago`
  else if (diffDays >= 1 && diffDays < 7) relative = `${diffDays}d ago`

  const exact = d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return { relative, exact }
}

function describeMeta(action: string, meta: Record<string, unknown> | null): string | null {
  if (!meta || Object.keys(meta).length === 0) return null
  if (action === 'bulk_import_products') {
    const parts: string[] = []
    if (typeof meta.imported === 'number') parts.push(`${meta.imported} imported`)
    if (typeof meta.failed === 'number' && meta.failed > 0) parts.push(`${meta.failed} failed`)
    return parts.length > 0 ? parts.join(' · ') : null
  }
  if (meta.status != null) return `Status → ${String(meta.status)}`
  return null
}

function describeLog(log: AuditLog) {
  const who = log.profiles?.full_name?.trim() || 'System'
  const what =
    ACTION_LABELS[log.action] ??
    log.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const area = log.resource ? (RESOURCE_LABELS[log.resource] ?? log.resource) : null
  const preview = describeMeta(log.action, log.meta)
  const tone = actionTone(log.action)
  return { who, what, area, preview, tone }
}

function ActionBadge({ action }: { action: string }) {
  const tone = actionTone(action)
  const styles = TONE_STYLES[tone]
  const label =
    ACTION_LABELS[action] ??
    action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles.badge}`}>
      {label}
    </span>
  )
}

function SnapshotCard({ snapshot }: { snapshot: ResourceSnapshot }) {
  const statusClass =
    snapshot.type === 'product' && snapshot.status === 'active'
      ? 'text-emerald-700 bg-emerald-50'
      : snapshot.type === 'product' && snapshot.status === 'draft'
        ? 'text-amber-800 bg-amber-50'
        : 'text-ink-muted bg-surface'

  return (
    <div className="rounded-xl border border-divider bg-gradient-to-br from-white to-surface/60 p-4">
      {snapshot.type === 'product' && (
        <>
          <p className="font-display text-lg text-deep-teal leading-tight">{snapshot.name}</p>
          {snapshot.design_number && (
            <p className="text-xs font-mono text-ink-muted mt-1">Design {snapshot.design_number}</p>
          )}
          <span className={`inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${statusClass}`}>
            {snapshot.status}
          </span>
        </>
      )}
      {snapshot.type === 'collection' && (
        <>
          <p className="font-display text-lg text-deep-teal">{snapshot.name}</p>
          <p className="text-xs text-ink-muted mt-1">
            {snapshot.is_active ? 'Live on storefront' : 'Inactive'}
          </p>
        </>
      )}
      {snapshot.type === 'blog' && (
        <>
          <p className="font-display text-lg text-deep-teal">{snapshot.title}</p>
          {snapshot.status && (
            <p className="text-xs text-ink-muted mt-1 capitalize">{snapshot.status}</p>
          )}
        </>
      )}
      {snapshot.type === 'order' && (
        <>
          <p className="font-display text-lg text-deep-teal">
            Order #{snapshot.order_number ?? snapshot.id.slice(0, 8)}
          </p>
          {snapshot.status && (
            <p className="text-xs text-ink-muted mt-1 capitalize">{snapshot.status}</p>
          )}
        </>
      )}
    </div>
  )
}

function DetailContent({
  detail,
  loading,
}: {
  detail: LogDetail | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-ink-faint">
        <Loader2 className="h-6 w-6 animate-spin mb-3" />
        <p className="text-sm">Loading details…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-surface flex items-center justify-center mb-4">
          <Sparkles className="h-6 w-6 text-teal/60" />
        </div>
        <p className="font-display text-lg text-deep-teal">Select an activity</p>
        <p className="text-sm text-ink-muted mt-2 max-w-xs">
          Click any entry on the left to see what changed, quick links, and storefront preview.
        </p>
      </div>
    )
  }

  const { log, links, snapshot, snapshotMissing } = detail
  const summary = describeLog(log)
  const when = formatWhen(log.created_at)
  const metaRows = formatMetaEntries(log.meta)
  const storefrontLinks = links.filter((l) => l.kind === 'storefront')
  const cmsLinks = links.filter((l) => l.kind === 'cms')
  const tone = TONE_STYLES[summary.tone]

  return (
    <div className="p-6 space-y-6">
      <div className={`rounded-xl border p-4 ${tone.badge}`}>
        <ActionBadge action={log.action} />
        <p className="text-sm mt-3 text-ink/90">
          <span className="font-semibold">{summary.who}</span> performed this action
        </p>
        <p className="text-xs mt-2 opacity-80">{when.exact} · {when.relative}</p>
      </div>

      {snapshot && (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Item
          </h4>
          <SnapshotCard snapshot={snapshot} />
        </section>
      )}

      {snapshotMissing && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          This record was deleted or no longer exists.
        </p>
      )}

      {(storefrontLinks.length > 0 || cmsLinks.length > 0) && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Links
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {storefrontLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-teal text-white px-4 py-3 text-sm font-medium hover:bg-deep-teal transition-colors shadow-sm"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">{link.label}</span>
              </a>
            ))}
            {cmsLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center justify-center gap-2 rounded-xl border border-divider bg-white px-4 py-3 text-sm text-ink hover:border-teal/40 hover:bg-teal/5 transition-colors"
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
          {storefrontLinks.map((link) =>
            link.note ? (
              <p key={`${link.href}-note`} className="text-xs text-ink-faint leading-relaxed">
                {link.note}
              </p>
            ) : null,
          )}
        </section>
      )}

      {metaRows.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Details
          </h4>
          <div className="rounded-xl border border-divider overflow-hidden divide-y divide-divider">
            {metaRows.map((row) => (
              <div key={row.key} className="flex justify-between gap-4 px-4 py-2.5 text-sm bg-white">
                <span className="text-ink-muted shrink-0">{row.label}</span>
                <span className="text-ink text-right break-all text-xs">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [area, setArea] = useState('')
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<LogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  const fetchLogs = useCallback(async (p: number, res: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      if (res) params.set('resource', res)
      const r = await fetch(`/api/audit-logs?${params}`)
      if (r.status === 403) {
        setError('Only super admins can view audit logs.')
        return
      }
      const json = await r.json()
      if (!r.ok) {
        setError(json.error ?? 'Failed to load logs')
        return
      }
      setLogs(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [])

  const openLog = useCallback(async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    setMobileDetailOpen(true)
    try {
      const r = await fetch(`/api/audit-logs/${id}`)
      const json = await r.json()
      if (!r.ok) return
      setDetail({
        log: json.log,
        links: json.links ?? [],
        snapshot: json.snapshot ?? null,
        snapshotMissing: json.snapshotMissing ?? false,
      })
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeMobileDetail = useCallback(() => {
    setMobileDetailOpen(false)
  }, [])

  useEffect(() => {
    fetchLogs(page, area)
  }, [fetchLogs, page, area])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-deep-teal">Audit Logs</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {total} activities · select one to view details
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchLogs(page, area)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-divider rounded-xl text-sm text-ink-muted hover:bg-white hover:border-teal/30 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.value || 'all'}
            type="button"
            onClick={() => {
              setArea(chip.value)
              setPage(1)
            }}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              area === chip.value
                ? 'bg-teal text-white shadow-sm'
                : 'bg-white border border-divider text-ink-muted hover:border-teal/40 hover:text-teal'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-5 items-start">
        {/* Timeline list */}
        <div className="lg:col-span-2 bg-white border border-divider rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-ink-faint">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 px-4">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 text-ink-faint/30" />
              <p className="text-sm text-ink-muted">No activity in this filter.</p>
            </div>
          ) : (
            <ul className="relative">
              <div className="absolute left-[1.65rem] top-4 bottom-4 w-px bg-divider" aria-hidden />
              {logs.map((log) => {
                const { who, what, area: areaLabel, preview, tone } = describeLog(log)
                const when = formatWhen(log.created_at)
                const isSelected = selectedId === log.id
                const styles = TONE_STYLES[tone]

                return (
                  <li key={log.id}>
                    <button
                      type="button"
                      onClick={() => openLog(log.id)}
                      className={`relative w-full flex gap-3 px-4 py-4 text-left transition-all ${
                        isSelected
                          ? `bg-teal/[0.06] ring-2 ring-inset ${styles.ring}`
                          : 'hover:bg-surface/50'
                      }`}
                    >
                      <div className="relative z-10 shrink-0">
                        <div
                          className={`h-3 w-3 rounded-full mt-2 ring-4 ring-white ${styles.dot}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-deep-teal/10 text-[10px] font-bold text-deep-teal">
                            {initials(who)}
                          </span>
                          <span className="text-xs font-medium text-ink truncate">{who}</span>
                          <span className="text-xs text-ink-faint ml-auto shrink-0">{when.relative}</span>
                        </div>
                        <p className="text-sm text-ink mt-1.5 leading-snug line-clamp-2">{what}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {areaLabel && (
                            <span className="text-[10px] uppercase tracking-wide text-ink-faint font-medium">
                              {areaLabel}
                            </span>
                          )}
                          {preview && (
                            <span className="text-[11px] text-ink-muted truncate">{preview}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-divider bg-surface/40">
              <p className="text-xs text-ink-faint">
                {page} / {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-divider hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-divider hover:bg-white disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop detail panel */}
        <div className="hidden lg:block lg:col-span-3 bg-white border border-divider rounded-2xl shadow-sm sticky top-6 min-h-[420px]">
          <DetailContent detail={detail} loading={detailLoading && !!selectedId} />
        </div>
      </div>

      {/* Mobile detail sheet */}
      {mobileDetailOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={closeMobileDetail}
          />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-divider bg-white/95 backdrop-blur">
              <h3 className="font-display text-lg text-deep-teal">Details</h3>
              <button
                type="button"
                onClick={closeMobileDetail}
                className="p-2 rounded-lg hover:bg-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <DetailContent detail={detail} loading={detailLoading} />
          </div>
        </div>
      )}
    </div>
  )
}
