'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, PanelLeftOpen, Search, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNotificationStore } from '@/stores/notificationStore'

const TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/products':     'Products',
  '/collections':  'Collections',
  '/orders':       'Orders',
  '/customers':    'Customers',
  '/requests':     'Requests',
  '/reviews':      'Reviews',
  '/blogs':        'Blogs',
  '/testimonials': 'Testimonials',
  '/stores':       'Stores',
  '/settings':     'Settings',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [notifOpen, setNotifOpen] = useState(false)
  const { notifications, markAllRead, counts } = useNotificationStore()
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const [adminName, setAdminName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me/profile')
      .then(r => r.json())
      .then(d => { if (d?.name) setAdminName(d.name) })
      .catch(() => {})
  }, [])

  const title = Object.entries(TITLES).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1]
    ?? (pathname === '/profile' ? 'My Profile' : 'CMS')

  return (
    <header className={`fixed top-0 right-0 z-20 h-14 bg-white border-b border-divider flex items-center px-6 gap-4 transition-[left] duration-200 ${sidebarCollapsed ? 'left-0' : 'left-60'}`}>
      <button
        type="button"
        onClick={onToggleSidebar}
        className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-lg border border-divider text-ink-muted hover:text-deep-teal hover:border-teal hover:bg-surface transition-colors"
        aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        <PanelLeftOpen className="w-4 h-4" />
      </button>
      <h1 className="font-display text-lg text-deep-teal">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-surface rounded-lg px-3 py-1.5 text-ink-muted text-sm w-48">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input placeholder="Quick search…" className="bg-transparent outline-none w-full text-xs placeholder:text-ink-faint" />
        </div>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(o => !o); markAllRead() }}
            className="relative p-2 rounded-lg hover:bg-surface transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-ink-muted" />
            {totalCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-gold rounded-full ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-divider z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Notifications</span>
                <span className="text-xs text-ink-faint">{notifications.length} recent</span>
              </div>
              <ul className="max-h-64 overflow-y-auto divide-y divide-divider">
                {notifications.length === 0 ? (
                  <li className="px-4 py-6 text-center text-ink-faint text-sm">All clear!</li>
                ) : notifications.slice(0, 8).map((n, i) => (
                  <li key={i} className="px-4 py-3">
                    <p className="text-sm text-ink">{n.message}</p>
                    <p className="text-xs text-ink-faint mt-0.5">{new Date(n.at).toLocaleTimeString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* User avatar → profile page */}
        <button
          onClick={() => router.push('/profile')}
          title="My Profile"
          className="w-8 h-8 rounded-full bg-deep-teal flex items-center justify-center text-white text-xs font-bold hover:opacity-90 transition-opacity ring-2 ring-offset-1 ring-transparent hover:ring-gold focus:outline-none focus:ring-gold"
        >
          {adminName ? initials(adminName) : <User className="w-4 h-4" />}
        </button>
      </div>
    </header>
  )
}
