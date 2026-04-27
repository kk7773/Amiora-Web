'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { isSupabasePublicEnvOk } from '@/lib/supabase/envMatch'

const AUTH_ROUTES = ['/login', '/auth']

export function CMSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_ROUTES.some(r => pathname.startsWith(r))

  // Realtime uses the anon key; if URL/key missing or mismatched → "Invalid API key" overlay
  const realtimeEnabled = isSupabasePublicEnvOk()
  useRealtimeNotifications(realtimeEnabled)

  if (isAuth) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-60">
        <TopBar />
        <main className="flex-1 pt-14 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
