'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createBrowserClient } from '@amiora/database'
import { toast } from 'sonner'
import { cn } from '@amiora/ui'
import { ACCOUNT_NAV } from '@/lib/account/nav'

export function AccountSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const handleSignOut = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="space-y-1">
      {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/account' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors',
              active
                ? 'bg-teal/10 text-teal font-medium'
                : 'text-ink-muted hover:bg-surface hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-ink-muted hover:bg-red-50 hover:text-red-500 transition-colors mt-4"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </aside>
  )
}
