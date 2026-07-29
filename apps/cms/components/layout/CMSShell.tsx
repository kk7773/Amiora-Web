'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DisableNumberWheel } from './DisableNumberWheel'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { isSupabasePublicEnvOk } from '@/lib/supabase/envMatch'

const AUTH_ROUTES = ['/login', '/auth']
const SIDEBAR_PREF_KEY = 'amiora:cms-sidebar-collapsed'

export function CMSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_ROUTES.some(r => pathname.startsWith(r))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_PREF_KEY)
    setSidebarCollapsed(saved === 'true')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_PREF_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Realtime uses the anon key; if URL/key missing or mismatched → "Invalid API key" overlay
  const realtimeEnabled = isSupabasePublicEnvOk()
  useRealtimeNotifications(realtimeEnabled)

  if (isAuth) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <DisableNumberWheel />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />
      <div className={`flex flex-col flex-1 transition-[margin] duration-200 ${sidebarCollapsed ? 'ml-0' : 'ml-60'}`}>
        <TopBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)} />
        <main className="flex-1 pt-14 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
