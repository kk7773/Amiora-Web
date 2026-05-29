'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, ClipboardList, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

interface AuditLog {
  id:          string
  action:      string
  resource:    string | null
  resource_id: string | null
  meta:        Record<string, unknown> | null
  created_at:  string
  profiles:    { full_name: string | null } | null
}

const ACTION_COLORS: Record<string, string> = {
  create_admin:       'bg-green-100 text-green-700',
  delete_admin:       'bg-red-100 text-red-700',
  update_permissions: 'bg-blue-100 text-blue-700',
  disable_admin:      'bg-orange-100 text-orange-700',
  enable_admin:       'bg-teal/10 text-teal',
  reset_admin_password: 'bg-amber-100 text-amber-700',
  update_admin_name:  'bg-gray-100 text-gray-600',
}

function actionBadge(action: string) {
  const cls = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600'
  const label = action.replace(/_/g, ' ')
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${cls}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const LIMIT = 50

export function AuditLogsClient() {
  const [logs,     setLogs]     = useState<AuditLog[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [action,   setAction]   = useState('')
  const [resource, setResource] = useState('')
  const [error,    setError]    = useState('')

  const fetchLogs = useCallback(async (p: number, act: string, res: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      if (act) params.set('action',   act)
      if (res) params.set('resource', res)
      const r = await fetch(`/api/audit-logs?${params}`)
      if (r.status === 403) { setError('You need super admin access to view audit logs.'); return }
      const json = await r.json()
      if (!r.ok) { setError(json.error ?? 'Failed to load logs'); return }
      setLogs(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs(page, action, resource)
  }, [fetchLogs, page, action, resource])

  function handleFilter(act: string, res: string) {
    setAction(act)
    setResource(res)
    setPage(1)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Read-only record of all CMS admin actions. Visible to super admins only.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(page, action, resource)}
          className="flex items-center gap-2 px-3 py-2 border border-divider rounded-lg text-sm text-gray-600 hover:bg-surface transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={action}
          onChange={e => handleFilter(e.target.value, resource)}
          className="px-3 py-2 text-sm border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 bg-white"
        >
          <option value="">All actions</option>
          <option value="create_admin">Create admin</option>
          <option value="delete_admin">Delete admin</option>
          <option value="update_permissions">Update permissions</option>
          <option value="disable_admin">Disable admin</option>
          <option value="enable_admin">Enable admin</option>
          <option value="reset_admin_password">Reset password</option>
          <option value="create_product">Create product</option>
          <option value="update_product">Update product</option>
          <option value="delete_product">Delete product</option>
          <option value="create_blog">Create blog</option>
          <option value="update_blog">Update blog</option>
          <option value="create_collection">Create collection</option>
          <option value="update_collection">Update collection</option>
        </select>

        <select
          value={resource}
          onChange={e => handleFilter(action, e.target.value)}
          className="px-3 py-2 text-sm border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 bg-white"
        >
          <option value="">All resources</option>
          <option value="admin-management">Admin management</option>
          <option value="products">Products</option>
          <option value="collections">Collections</option>
          <option value="orders">Orders</option>
          <option value="blogs">Blogs</option>
          <option value="coupons">Coupons</option>
          <option value="faqs">FAQs</option>
          <option value="reviews">Reviews</option>
          <option value="stores">Stores</option>
          <option value="testimonials">Testimonials</option>
        </select>

        {(action || resource) && (
          <button
            onClick={() => handleFilter('', '')}
            className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">{total} total entries</span>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No audit log entries found.</p>
        </div>
      ) : (
        <div className="bg-white border border-divider rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider bg-surface/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {log.profiles?.full_name ?? <span className="text-gray-400 italic">system</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {actionBadge(log.action)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {log.resource ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[10px] text-gray-400 font-mono">
                        {log.resource_id ? log.resource_id.slice(0, 8) + '…' : '—'}
                      </code>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {log.meta ? (
                        <code className="text-[10px] text-gray-400 font-mono break-all line-clamp-2">
                          {JSON.stringify(log.meta)}
                        </code>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-divider bg-surface/40">
              <p className="text-xs text-gray-400">
                Page {page} of {totalPages} ({total} entries)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-divider hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded border border-divider hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
