'use client'

import { useState, useEffect, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  UserPlus, Trash2, Loader2, ShieldCheck, Shield, Eye, EyeOff,
  ChevronDown, ChevronUp, Check, X, AlertCircle, KeyRound,
  ToggleLeft, ToggleRight, Edit2,
} from 'lucide-react'
import { toast } from 'sonner'

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

interface TabPermission {
  slug:     string
  can_view: boolean
  can_edit: boolean
}

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
  cms_role: 'super_admin' | 'admin'
  showPass: boolean
}

interface ConfirmState {
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'default'
  pending?: boolean
  onConfirm: () => Promise<void>
}

const EMPTY_FORM: CreateForm = {
  name: '',
  email: '',
  password: '',
  cms_role: 'admin',
  showPass: false,
}

/** Cycle: none → view → view+edit → none */
function cyclePermission(p: TabPermission): TabPermission {
  if (!p.can_view && !p.can_edit) return { ...p, can_view: true,  can_edit: false }
  if (p.can_view  && !p.can_edit) return { ...p, can_view: true,  can_edit: true  }
  return { ...p, can_view: false, can_edit: false }
}

function permLabel(p: TabPermission) {
  if (!p.can_view) return 'None'
  if (!p.can_edit) return 'View'
  return 'View + Edit'
}

function permColor(p: TabPermission) {
  if (!p.can_view) return 'bg-white text-gray-400 border-divider hover:border-gray-300'
  if (!p.can_edit) return 'bg-amber-50 text-amber-700 border-amber-300'
  return 'bg-deep-teal text-white border-deep-teal'
}

export function AdminManagementClient() {
  const [admins,      setAdmins]     = useState<Admin[]>([])
  const [loading,     setLoading]    = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [showCreate,  setShowCreate] = useState(false)
  const [form,        setForm]       = useState<CreateForm>(EMPTY_FORM)
  const [saving,      setSaving]     = useState(false)
  const [error,       setError]      = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [expanded,      setExpanded]     = useState<string | null>(null)
  const [perms,         setPerms]        = useState<Record<string, TabPermission[]>>({})
  const [permSaving,    setPermSaving]   = useState<string | null>(null)
  const [resetAdminId,  setResetAdminId] = useState<string | null>(null)
  const [newPassword,   setNewPassword]  = useState('')
  const [showNewPass,   setShowNewPass]  = useState(false)
  const [resetSaving,   setResetSaving]  = useState(false)
  const [toggling,      setToggling]     = useState<string | null>(null)
  const [, startT]                       = useTransition()

  useEffect(() => {
    fetch('/api/admin-management')
      .then(r => r.json())
      .then(d => setAdmins(d.data ?? []))
      .finally(() => setLoading(false))

    fetch('/api/me/profile')
      .then(r => r.json())
      .then(d => setCurrentUserEmail(typeof d.email === 'string' ? d.email.toLowerCase() : null))
      .catch(() => setCurrentUserEmail(null))
  }, [])

  async function loadPerms(adminId: string) {
    if (perms[adminId]) return
    const res  = await fetch(`/api/admin-management/${adminId}/permissions`)
    const json = await res.json()
    // Normalise: API may return TabPermission[] or legacy string[]
    const raw: (TabPermission | string)[] = json.tabs ?? []
    const normalised: TabPermission[] = raw.map(t =>
      typeof t === 'string'
        ? { slug: t, can_view: true, can_edit: true }
        : t
    )
    // Ensure every tab has an entry (default: no access)
    const map = new Map(normalised.map(p => [p.slug, p]))
    const full = ALL_TABS.map(tab => map.get(tab.slug) ?? { slug: tab.slug, can_view: false, can_edit: false })
    setPerms(prev => ({ ...prev, [adminId]: full }))
  }

  function toggleExpand(adminId: string) {
    if (expanded === adminId) {
      setExpanded(null)
    } else {
      setExpanded(adminId)
      loadPerms(adminId)
    }
  }

  function cycleTab(adminId: string, slug: string) {
    setPerms(prev => {
      const cur = prev[adminId] ?? ALL_TABS.map(t => ({ slug: t.slug, can_view: false, can_edit: false }))
      return {
        ...prev,
        [adminId]: cur.map(p => p.slug === slug ? cyclePermission(p) : p),
      }
    })
  }

  function selectAll(adminId: string) {
    setPerms(prev => ({
      ...prev,
      [adminId]: ALL_TABS.map(t => ({ slug: t.slug, can_view: true, can_edit: true })),
    }))
  }

  function clearAll(adminId: string) {
    setPerms(prev => ({
      ...prev,
      [adminId]: ALL_TABS.map(t => ({ slug: t.slug, can_view: false, can_edit: false })),
    }))
  }

  async function savePerms(adminId: string) {
    setPermSaving(adminId)
    const tabs = (perms[adminId] ?? []).filter(p => p.can_view || p.can_edit)
    const res  = await fetch(`/api/admin-management/${adminId}/permissions`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tabs }),
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
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: newPassword }),
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

  async function toggleActive(admin: Admin) {
    const newState = !admin.is_active
    const label    = newState ? 'enable' : 'disable'
    setConfirmState({
      title: `${newState ? 'Enable' : 'Disable'} ${admin.name}?`,
      description: newState
        ? 'They will be able to log in again.'
        : 'They will be signed out immediately.',
      confirmLabel: newState ? 'Enable' : 'Disable',
      tone: newState ? 'default' : 'danger',
      onConfirm: async () => {
        setToggling(admin.id)
        const res = await fetch(`/api/admin-management/${admin.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ is_active: newState }),
        })
        setToggling(null)

        if (res.ok) {
          setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, is_active: newState } : a))
          toast.success(`Admin ${label}d successfully`)
          setConfirmState(null)
        } else {
          const j = await res.json()
          toast.error(j.error ?? `Failed to ${label} admin`)
        }
      },
    })
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        cms_role: form.cms_role,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Failed to create admin'); return }
    startT(() => setAdmins(prev => [json.data, ...prev]))
    setShowCreate(false)
    setForm(EMPTY_FORM)
    toast.success(`${form.cms_role === 'super_admin' ? 'Super admin' : 'Admin'} "${form.name}" created!`)
  }

  async function deleteAdmin(admin: Admin) {
    setConfirmState({
      title: `Remove ${admin.name}?`,
      description: `${admin.email} will be removed from CMS. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        const res = await fetch(`/api/admin-management/${admin.id}`, { method: 'DELETE' })
        if (res.ok) {
          setAdmins(prev => prev.filter(a => a.id !== admin.id))
          toast.success('Admin removed')
          setConfirmState(null)
        } else {
          const j = await res.json().catch(() => ({}))
          toast.error(j.error ?? 'Failed to remove admin')
        }
      },
    })
  }

  return (
    <>
      <Dialog.Root open={confirmState !== null} onOpenChange={(open) => { if (!open) setConfirmState(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-divider bg-white p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {confirmState?.title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-gray-500">
              {confirmState?.description}
            </Dialog.Description>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <button className="rounded-lg border border-divider px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-surface">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={() => void confirmState?.onConfirm()}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 ${
                  confirmState?.tone === 'danger' ? 'bg-red-600' : 'bg-deep-teal'
                }`}
              >
                {confirmState?.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
              <label className={lbl}>Role *</label>
              <select
                value={form.cms_role}
                onChange={e => setForm(f => ({ ...f, cms_role: e.target.value as CreateForm['cms_role'] }))}
                className={inp}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div>
              <label className={lbl}>Access *</label>
              <div className="flex h-[46px] items-center rounded-lg border border-gray-200 bg-surface px-3 text-sm text-gray-600">
                {form.cms_role === 'super_admin'
                  ? 'Full CMS access, including Admin Management and Audit Logs'
                  : 'Create with standard admin role; tab permissions can be granted below'}
              </div>
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
            The user will log in with these credentials. {form.cms_role === 'super_admin'
              ? 'Super admins receive full CMS access immediately.'
              : <>Tab access is <strong>disabled by default</strong> — grant access below after creation.</>}
          </p>
          <div className="flex gap-2">
            <button
              onClick={createAdmin}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {form.cms_role === 'super_admin' ? 'Create Super Admin' : 'Create Admin'}
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-medium">Tab permission levels:</span>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded border border-divider bg-white text-gray-400 text-[11px]">None</span>
          no access
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 text-[11px]">View</span>
          read-only
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded border border-deep-teal bg-deep-teal text-white text-[11px]">View + Edit</span>
          full access
        </span>
        <span className="text-gray-400">(click to cycle)</span>
      </div>

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
            const adminPerms = perms[admin.id] ?? []
            const isSuperAdm = admin.cms_role === 'super_admin'
            const grantedCount = adminPerms.filter(p => p.can_view || p.can_edit).length
            const isCurrentUser = currentUserEmail !== null && admin.email.toLowerCase() === currentUserEmail
            const canDelete = !isCurrentUser

            return (
              <div
                key={admin.id}
                className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                  admin.is_active ? 'border-divider' : 'border-red-200 bg-red-50/30'
                }`}
              >
                {/* Admin row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                    !admin.is_active ? 'bg-gray-400' : isSuperAdm ? 'bg-deep-teal' : 'bg-teal'
                  }`}>
                    {(admin.name?.[0] ?? admin.email[0]).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold truncate ${admin.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {admin.name}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                        isSuperAdm
                          ? 'bg-deep-teal/10 text-deep-teal'
                          : 'bg-teal/10 text-teal'
                      }`}>
                        {isSuperAdm ? <ShieldCheck className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                        {isSuperAdm ? 'Super Admin' : 'Admin'}
                      </span>
                      {!admin.is_active && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-red-100 text-red-600">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                  </div>

                  {/* Tab count */}
                  {!isSuperAdm && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {isOpen
                        ? `${grantedCount} tab${grantedCount !== 1 ? 's' : ''} granted`
                        : perms[admin.id] !== undefined
                          ? `${grantedCount} tab${grantedCount !== 1 ? 's' : ''}`
                          : '…'}
                    </span>
                  )}
                  {isSuperAdm && (
                    <span className="text-xs text-gray-400 shrink-0">Full access</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Enable / Disable toggle */}
                    {!isCurrentUser && (
                      <button
                        onClick={() => toggleActive(admin)}
                        disabled={toggling === admin.id}
                        className={`p-1.5 rounded transition-colors ${
                          admin.is_active
                            ? 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                            : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                        }`}
                        title={admin.is_active ? `Disable ${isSuperAdm ? 'super admin' : 'admin'}` : `Enable ${isSuperAdm ? 'super admin' : 'admin'}`}
                      >
                        {toggling === admin.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : admin.is_active
                            ? <ToggleRight className="h-4 w-4 text-green-500" />
                            : <ToggleLeft className="h-4 w-4 text-gray-400" />
                        }
                      </button>
                    )}

                    {/* Reset password */}
                    {true && (
                      <button
                        onClick={() => {
                          setResetAdminId(resetAdminId === admin.id ? null : admin.id)
                          setNewPassword('')
                          setShowNewPass(false)
                          if (!isSuperAdm && expanded !== admin.id) toggleExpand(admin.id)
                        }}
                        className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                        title={`Reset ${isSuperAdm ? 'super admin' : 'admin'} password`}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Expand / collapse permissions */}
                    {!isSuperAdm && (
                      <button
                        onClick={() => toggleExpand(admin.id)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-deep-teal transition-colors"
                        title="Manage permissions"
                      >
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}

                    {/* Delete */}
                    {canDelete && (
                      <button
                        onClick={() => deleteAdmin(admin)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title={isSuperAdm ? 'Remove super admin' : 'Remove admin'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions panel */}
                {isOpen && !isSuperAdm && (
                  <div className="border-t border-divider bg-surface/40 px-5 py-4 space-y-4">

                    {/* Reset Password inline form */}
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
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Edit2 className="h-3 w-3" />
                        Tab Access — <span className="text-deep-teal">{admin.name}</span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAll(admin.id)}
                          className="text-xs text-teal hover:text-deep-teal underline underline-offset-2"
                        >
                          Grant all
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                          onClick={() => clearAll(admin.id)}
                          className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2"
                        >
                          Revoke all
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {ALL_TABS.map(tab => {
                        const p = adminPerms.find(x => x.slug === tab.slug) ?? { slug: tab.slug, can_view: false, can_edit: false }
                        return (
                          <button
                            key={tab.slug}
                            onClick={() => cycleTab(admin.id, tab.slug)}
                            className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${permColor(p)}`}
                            title="Click to cycle: None → View → View+Edit → None"
                          >
                            <span className="truncate">{tab.label}</span>
                            <span className="shrink-0 text-[10px] font-semibold opacity-80">
                              {!p.can_view
                                ? <X className="h-3 w-3 opacity-30" />
                                : !p.can_edit
                                  ? <Eye className="h-3 w-3" />
                                  : <Check className="h-3 w-3" />
                              }
                            </span>
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
                      <p className="text-xs text-gray-400">Changes take effect on next request.</p>
                    </div>
                  </div>
                )}

                {/* Super-admin reset password inline form */}
                {isSuperAdm && resetAdminId === admin.id && (
                  <div className="border-t border-divider bg-surface/40 px-5 py-4">
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </>
  )
}

const lbl = 'block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5'
const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors bg-white'

// Re-export permLabel so it can be used in tooltips or summaries if needed
export { permLabel }
