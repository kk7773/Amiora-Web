import { User, Package, Heart, MessageSquare, type LucideIcon } from 'lucide-react'

export const ACCOUNT_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/account',           label: 'Profile',   icon: User           },
  { href: '/account/orders',    label: 'My Orders', icon: Package        },
  { href: '/account/wishlist',  label: 'Wishlist',  icon: Heart          },
  { href: '/account/requests',  label: 'Requests',  icon: MessageSquare  },
]
