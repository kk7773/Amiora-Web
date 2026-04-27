'use client'

import { useEffect, useState } from 'react'
import {
  ShieldCheck, User, Mail, Calendar, Lock,
  LayoutDashboard, Package, Layers, ShoppingBag, Users,
  MessageSquare, Star, FileText, Quote, MapPin,
  Ticket, HelpCircle, TrendingUp, Settings, ShieldAlert,
} from 'lucide-react'

interface ProfileData {
  name: string
  email: string
  cms_role: 'super_admin' | 'admin'
  tabs: string[] | null   // null = all access
  joined_at: string | null
}

const TAB_META: Record<string, { label: string; icon: React.ElementType }> = {
  dashboard:        { label: 'Dashboard',        icon: LayoutDashboard },
  products:         { label: 'Products',         icon: Package },
  collections:      { label: 'Collections',      icon: Layers },
  orders:           { label: 'Orders',           icon: ShoppingBag },
  customers:        { label: 'Customers',        icon: Users },
  requests:         { label: 'Requests',         icon: MessageSquare },
  reviews:          { label: 'Reviews',          icon: Star },
  blogs:            { label: 'Blogs',            icon: FileText },
  testimonials:     { label: 'Testimonials',     icon: Quote },
  stores:           { label: 'Stores',           icon: MapPin },
  coupons:          { label: 'Coupons',          icon: Ticket },
  faqs:             { label: 'FAQs',             icon: HelpCircle },
  pricing:          { label: 'Pricing',          icon: TrendingUp },
  settings:         { label: 'Settings',         icon: Settings },
}

const ALL_TABS = Object.keys(TAB_META)

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function ProfileClient() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me/profile')
      .then(r => r.json())
      .then(data => { setProfile(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-deep-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile || ('error' in (profile as object))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-ink-muted">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <p>Could not load profile. Please refresh.</p>
      </div>
    )
  }

  const isSuperAdmin = profile.cms_role === 'super_admin'
  const grantedTabs  = isSuperAdmin ? ALL_TABS : (profile.tabs ?? [])

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">

      {/* ── Avatar + name card ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-divider overflow-hidden">
        {/* Teal banner */}
        <div className="h-24 bg-gradient-to-r from-deep-teal to-teal" />

        <div className="px-6 pb-6">
          {/* Avatar overlapping banner */}
          <div className="-mt-10 mb-3 flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-deep-teal border-4 border-white flex items-center justify-center text-white text-2xl font-bold shadow-md select-none">
              {initials(profile.name)}
            </div>
            <div className="pb-1">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isSuperAdmin
                    ? 'bg-gold/15 text-[#a07820]'
                    : 'bg-teal/10 text-deep-teal'
                }`}
              >
                {isSuperAdmin ? <ShieldCheck className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </div>

          <h2 className="text-xl font-display font-semibold text-ink">{profile.name}</h2>
          <p className="text-sm text-ink-muted mt-0.5">{profile.email}</p>
        </div>
      </div>

      {/* ── Details card ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-divider divide-y divide-divider">
        <h3 className="px-6 py-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">
          Account Details
        </h3>

        <DetailRow icon={User} label="Full Name" value={profile.name} />
        <DetailRow icon={Mail} label="Email Address" value={profile.email} />
        <DetailRow
          icon={ShieldCheck}
          label="Role"
          value={isSuperAdmin ? 'Super Admin' : 'Admin'}
          valueClass={isSuperAdmin ? 'text-[#a07820] font-semibold' : 'text-deep-teal font-semibold'}
        />
        <DetailRow
          icon={Calendar}
          label="Member Since"
          value={formatDate(profile.joined_at)}
        />
      </div>

      {/* ── Access card ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-divider">
        <div className="px-6 py-4 flex items-center justify-between border-b border-divider">
          <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">
            Tab Access
          </h3>
          {isSuperAdmin ? (
            <span className="text-xs bg-gold/15 text-[#a07820] font-semibold px-2.5 py-1 rounded-full">
              Full Access
            </span>
          ) : (
            <span className="text-xs bg-teal/10 text-deep-teal font-semibold px-2.5 py-1 rounded-full">
              {grantedTabs.length} / {ALL_TABS.length} tabs
            </span>
          )}
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_TABS.map(slug => {
            const meta    = TAB_META[slug]
            const granted = grantedTabs.includes(slug)
            const Icon    = meta.icon

            return (
              <div
                key={slug}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  granted
                    ? 'bg-teal/10 text-deep-teal'
                    : 'bg-surface text-ink-faint opacity-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-medium truncate">{meta.label}</span>
                {granted && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        {!isSuperAdmin && grantedTabs.length === 0 && (
          <p className="px-6 pb-5 text-sm text-ink-faint text-center">
            No tabs have been granted yet. Contact your Super Admin.
          </p>
        )}
      </div>

    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
  valueClass = 'text-ink',
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-ink-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-faint mb-0.5">{label}</p>
        <p className={`text-sm truncate ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}
