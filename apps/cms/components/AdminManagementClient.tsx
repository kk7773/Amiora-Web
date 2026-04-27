'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  UserPlus, Trash2, Loader2, ShieldCheck, Shield, Eye, EyeOff,
  ChevronDown, ChevronUp, Check, X, AlertCircle, KeyRound
} from 'lucide-react'
import { toast } from 'sonner'

// All CMS tabs that can be granted to regular admins
const ALL_TABS = [
  { slug: 'dashboard',    label: 'Dashboard' },
  { slug: 'products',     label: 'Products' },
  { slug: 'collections',  label: 'Collections' },
  { slug: 'orders',       label: 'Orders' },
  { slug: 'customers',    label: 'Customers' },
  { slug: 'requests',     label: 'Requests' },
  { slug: 'reviews',      label: 'Reviews' },
  { slug: 'blogs',        label: 'Blogs' },
  { slug: 'testimonials', label: 'Testimonials' },
  { slug: 'stores',       label: 'Stores' },
  { slug: 'coupons',      label: 'Coupons' },
  { slug: 'faqs',         label: 'FAQs' },
  { slug: 'pricing',      label: 'Pricing' },
  { slug: 'settings',     label: 'Settings' },
]

interface Admin {
  id:         string
  email:      string
  name:       string
  cms_role:   'super_admin' | 'admin'
  is_active:  boolean
  created_at: string
}

interface CreateForm {
  name:     string
  email:    string
  password: string
  showPass: boolean
}

const EMPTY_FORM: CreateForm = { name: '', email: '', password: '', showPass: false }

export function AdminManagementClient() {
  const [admins,      setAdmins]     = useState<Admin[]>([])
  const [loading,     setLoading]    = useState(true)
  const [showCreate,  setShowCreate] = useState(false)
  const [form,        setForm]       = useState<CreateForm>(EMPTY_FORM)
  const [saving,      setSaving]     = useState(false)
  const [error,       setError]      = useState('')
  const [expanded,      setExpanded]     = useState<string | null>(null)
  const [perms,         setPerms]        = useState<Record<string, string[]>>({})
  const [permSaving,    setPermSaving]   = useState<string | null>(null)
  const [resetAdminId,  setResetAdminId] = useState<string | null>(null)
  const [newPassword,   setNewPassword]  = useState('')
  const [showNewPass,   setShowNewPass]  = useState(false)
  const [resetSaving,   setResetSaving]  = useState(false)
  const [, startT]                       = useTransition()

  // Load admins
  useEffect(() => {
    fetch('/api/admin-management')
      .then(r => r.json())
      .then(d => setAdmins(d.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  // Load permissions when row is expanded
  async function loadPerms(adminId: string) {
    if (perms[adminId]) return // already loaded
    const res  = await fetch(`/api/admin-management/${adminId}/permissions`)
    const json = await res.json()
    setPerms(prev => ({ ...prev, [adminId]: json.tabs ?? [] }))
  }

  function toggleExpand(adminId: string) {
    if (expanded === adminId) {
      setExpanded(null)
    } else {
      setExpanded(adminId)
      loadPerms(adminId)
    }
  }

  function toggleTab(adminId: string, slug: string) {
    setPerms(prev => {
      const cur = prev[adminId] ?? []
      return {
        ...prev,
        [adminId]: cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug],
      }
    })
  }

  function selectAll(adminId: string) {
    setPerms(prev => ({ ...prev, [adminId]: ALL_TABS.map(t => t.slug) }))
  }

  function clearAll(adminId: string) {
    setPerms(prev => ({ ...prev, [adminId]: [] }))
  }

  async function savePerms(adminId: string) {
    setPermSaving(adminId)
    const tabs = perms[adminId] ?? []
    const res  = await fetch(`/api/admin-management/${adminId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs }),
    })
    setPermSaving(null)
    if (res.ok) {
      toast.success('Permissions updated!')
    } else {
      toast.error('Failed to save permissions')
    }
  }

  async function resetPassword(adminId: string) {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setResetSaving(true)
    const res  = await fetch(`/api/admin-management/${adminId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    setResetSaving(false)
    if (res.ok) {
      toast.success('Password updated! Admin can now log in with the new password.')
      setResetAdminId(null)
      setNewPassword('')
    } else {
      const j = await res.json()
      toast.error(j.error ?? 'Failed to reset password')
    }
  }

  async function createAdmin() {
    if (!form.name || !form.email || !form.password) {
      setError('All fields are required')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSaving(true)
    setError('')
    const res  = await fetch('/api/admin-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Failed to create admin'); return }
    startT(() => setAdmins(prev => [json.data, ...prev]))
    setShowCreate(false)
    setForm(EMPTY_FORM)
    toast.success(`Admin "${form.name}" created!`)
  }

  async function deleteAdmin(admin: Admin) {
    if (!confirm(`Remove ${admin.name} (${admin.email}) from CMS? This cannot be undone.`)) return
    const res = await fetch(`/api/admin-management/${admin.id}`, { method: 'DELETE' })
    if (res.ok) {
      setAdmins(prev => prev.filter(a => a.id !== admin.id))
      toast.success('Admin removed')
    } else {
      toast.error('Failed to remove admin')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create admins and control which CMS tabs they can access.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          <UserPlus className="h-4 w-4" />
          New Admin
        </button>
      </div>

      {/* Create admin form */}
      {showCreate && (
        <div className="bg-white border border-divider rounded-xl p-5 space-y-4">
          <h3 className="font-medium text-gray-900">Create New Admin</h3>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Full Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Rahul Sharma"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@amiora.com"
                className={inp}
              />
            </div>
          </div>
          <div className="relative">
            <label className={lbl}>Password * <span className="text-gray-400 font-normal">(min 8 chars)</span></label>
            <input
              type={form.showPass ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Strong password"
              className={`${inp} pr-10`}
            />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, showPass: !f.showPass }))}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {form.showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            The admin will log in with these credentials. Tab access is <strong>disabled by default</strong> — grant access below after creation.
          </p>
          <div className="flex gap-2">
            <button
              onClick={createAdmin}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Admin
            </button>
            <button
              onClick={() => { setShowCreate(false); setError(''); setForm(EMPTY_FORM) }}
              className="px-4 py-2 text-sm border border-divider rounded-lg hover:bg-surface text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Admin list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading admins…
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No admins yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map(admin => {
            const isOpen     = expanded === admin.id
            const adminTabs  = perms[admin.id] ?? []
            const isSuperAdm = admin.cms_role === 'super_admin'

            return (
              <div key={admin.id} className="bg-white border border-divider rounded-xl overflow-hidden">
                {/* Admin row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${isSuperAdm ? 'bg-deep-teal' : 'bg-teal'}`}>
                    {(admin.name?.[0] ?? admin.email[0]).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{admin.name}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                        isSuperAdm
                          ? 'bg-deep-teal/10 text-deep-teal'
                          : 'bg-teal/10 text-teal'
                      }`}>
                        {isSuperAdm ? <ShieldCheck className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                        {isSuperAdm ? 'Super Admin' : 'Admin'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                  </div>

                  {/* Tab count */}
                  {!isSuperAdm && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {isOpen
                        ? `${adminTabs.length} tab${adminTabs.length !== 1 ? 's' : ''} selected`
                        : perms[admin.id] !== undefined
                          ? `${perms[admin.id].length} tab${perms[admin.id].length !== 1 ? 's' : ''}`
                          : '…'}
                    </span>
                  )}
                  {isSuperAdm && (
                    <span className="text-xs text-gray-400 shrink-0">Full access</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isSuperAdm && (
                      <button
                        onClick={() => {
                          setResetAdminId(resetAdminId === admin.id ? null : admin.id)
                          setNewPassword('')
                          setShowNewPass(false)
                          if (expanded !== admin.id) toggleExpand(admin.id)
                        }}
                        className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                        title="Reset password"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!isSuperAdm && (
                      <button
                        onClick={() => toggleExpand(admin.id)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-deep-teal transition-colors"
                        title="Manage permissions"
                      >
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                    {!isSuperAdm && (
                      <button
                        onClick={() => deleteAdmin(admin)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove admin"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions panel */}
                {isOpen && !isSuperAdm && (
                  <div className="border-t border-divider bg-surface/40 px-5 py-4 space-y-4">

                    {/* ── Reset Password inline form ── */}
                    {resetAdminId === admin.id && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5" /> Reset Password — {admin.name}
                        </p>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showNewPass ? 'text' : 'password'}
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              placeholder="New password (min 8 chars)"
                              className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white pr-9"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPass(s => !s)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                            >
                              {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <button
                            onClick={() => resetPassword(admin.id)}
                            disabled={resetSaving || newPassword.length < 8}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50 shrink-0"
                          >
                            {resetSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Set Password
                          </button>
                          <button
                            onClick={() => { setResetAdminId(null); setNewPassword('') }}
                            className="p-2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Tab Access — <span className="text-deep-teal">{admin.name}</span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAll(admin.id)}
                          className="text-xs text-teal hover:text-deep-teal underline underline-offset-2"
                        >
                          Select all
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                          onClick={() => clearAll(admin.id)}
                          className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {ALL_TABS.map(tab => {
                        const enabled = adminTabs.includes(tab.slug)
                        return (
                          <button
                            key={tab.slug}
                            onClick={() => toggleTab(admin.id, tab.slug)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                              enabled
                                ? 'bg-deep-teal text-white border-deep-teal'
                                : 'bg-white text-gray-500 border-divider hover:border-teal hover:text-teal'
                            }`}
                          >
                            {enabled
                              ? <Check className="h-3 w-3 shrink-0" />
                              : <X className="h-3 w-3 shrink-0 opacity-40" />}
                            {tab.label}
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => savePerms(admin.id)}
                        disabled={permSaving === admin.id}
                        className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                      >
                        {permSaving === admin.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Save Permissions
                      </button>
                      <p className="text-xs text-gray-400">Changes take effect on next login.</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const lbl = 'block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5'
const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors bg-white'
