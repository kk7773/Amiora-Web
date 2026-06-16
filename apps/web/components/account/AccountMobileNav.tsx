'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@amiora/ui'
import { ACCOUNT_NAV } from '@/lib/account/nav'

export function AccountMobileNav({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1',
        className,
      )}
      aria-label="Account navigation"
    >
      {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/account' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors',
              active
                ? 'bg-deep-teal text-cream font-medium shadow-sm'
                : 'bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
