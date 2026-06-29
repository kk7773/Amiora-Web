'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Package, Layers, ShoppingBag, Users, MessageSquare,
  Star, FileText, Quote, MapPin, Settings, ChevronRight, LogOut, PanelLeftClose,
  TrendingUp, Ticket, HelpCircle, ShieldCheck, ClipboardList,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/stores/notificationStore'

const ALL_NAV_ITEMS = [
  { href: '/dashboard',        slug: 'dashboard',        label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/products',         slug: 'products',         label: 'Products',         icon: Package },
  { href: '/collections',      slug: 'collections',      label: 'Collections',      icon: Layers },
  { href: '/orders',           slug: 'orders',           label: 'Orders',           icon: ShoppingBag,    badge: 'orders' },
  { href: '/customers',        slug: 'customers',        label: 'Customers',        icon: Users },
  { href: '/requests',         slug: 'requests',         label: 'Requests',         icon: MessageSquare,  badge: 'requests' },
  { href: '/reviews',          slug: 'reviews',          label: 'Reviews',          icon: Star,           badge: 'reviews' },
  { href: '/blogs',            slug: 'blogs',            label: 'Blogs',            icon: FileText },
  { href: '/testimonials',     slug: 'testimonials',     label: 'Testimonials',     icon: Quote },
  { href: '/stores',           slug: 'stores',           label: 'Stores',           icon: MapPin },
  { href: '/coupons',          slug: 'coupons',          label: 'Coupons',          icon: Ticket },
  { href: '/faqs',             slug: 'faqs',             label: 'FAQs',             icon: HelpCircle },
  { href: '/pricing',          slug: 'pricing',          label: 'Pricing',          icon: TrendingUp },
  { href: '/settings',         slug: 'settings',         label: 'Settings',         icon: Settings },
  // Super admin only — never appears in cms_admin_permissions
  { href: '/admin-management', slug: 'admin-management', label: 'Admin Management', icon: ShieldCheck,    superAdminOnly: true },
  { href: '/audit-logs',       slug: 'audit-logs',       label: 'Audit Logs',       icon: ClipboardList,  superAdminOnly: true },
]

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname   = usePathname()
  const { counts } = useNotificationStore()

  const [cmsRole,     setCmsRole]     = useState<string | null>(null)
  const [allowedTabs, setAllowedTabs] = useState<string[] | null>(null) // null = all (super_admin)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        setCmsRole(d.cms_role ?? 'admin')
        setAllowedTabs(d.tabs ?? null)
      })
      .catch(() => {})
  }, [])

  // Filter nav: super_admin sees everything; regular admin only their granted tabs
  const navItems = ALL_NAV_ITEMS.filter(item => {
    if (item.superAdminOnly)                      return cmsRole === 'super_admin'
    if (cmsRole === 'super_admin' || allowedTabs === null) return true
    return allowedTabs.includes(item.slug)
  })

  async function signOut() {
    await fetch('/api/admin-login', { method: 'DELETE' })
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
    } catch {
      /* env may be invalid; cookie already cleared */
    }
    window.location.href = '/login'
  }

  return (
    <aside className={`fixed inset-y-0 left-0 z-30 hidden md:flex flex-col bg-sidebar-bg transition-transform duration-200 w-60 ${collapsed ? '-translate-x-full' : 'translate-x-0'}`}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white text-xs font-display font-bold">A</div>
          <div>
            <p className="text-cream font-display text-base leading-tight">AMIORA</p>
            <p className="text-sidebar-text text-[10px] tracking-widest uppercase">
              {cmsRole === 'super_admin' ? 'Super Admin' : 'Admin CMS'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-sidebar-text hover:bg-sidebar-hover hover:text-cream transition-colors"
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 hide-scrollbar">
        {navItems.map(({ href, label, icon: Icon, badge, superAdminOnly }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const count  = badge ? (counts as Record<string, number>)[badge] ?? 0 : 0
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all ${
                active
                  ? 'bg-sidebar-active text-cream'
                  : superAdminOnly
                    ? 'text-gold/70 hover:bg-sidebar-hover hover:text-gold'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-cream'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm flex-1">{label}</span>
              {count > 0 && (
                <span className="bg-gold text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
              {active && <ChevronRight className="w-3 h-3 opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-cream transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
