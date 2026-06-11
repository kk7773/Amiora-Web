'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Link2, Mail, Share2, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type ProductShareProps = {
  productName: string
}

type SocialKind = 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'telegram' | 'email'

const SOCIAL_LINKS: {
  kind: SocialKind
  label: string
  className: string
  Icon: () => React.JSX.Element
}[] = [
  {
    kind: 'whatsapp',
    label: 'Share on WhatsApp',
    className: 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/20',
    Icon: WhatsAppIcon,
  },
  {
    kind: 'telegram',
    label: 'Share on Telegram',
    className: 'bg-sky-500/10 text-sky-600 border-sky-500/30 hover:bg-sky-500/20',
    Icon: TelegramIcon,
  },
  {
    kind: 'facebook',
    label: 'Share on Facebook',
    className: 'bg-blue-600/10 text-blue-600 border-blue-600/30 hover:bg-blue-600/20',
    Icon: FacebookIcon,
  },
  {
    kind: 'x',
    label: 'Share on X',
    className: 'bg-ink/5 text-ink border-ink/15 hover:bg-ink/10',
    Icon: XIcon,
  },
  {
    kind: 'linkedin',
    label: 'Share on LinkedIn',
    className: 'bg-blue-800/10 text-blue-800 border-blue-800/30 hover:bg-blue-800/20',
    Icon: LinkedInIcon,
  },
  {
    kind: 'email',
    label: 'Share via email',
    className: 'bg-surface text-ink border-divider hover:border-teal hover:text-teal',
    Icon: () => <Mail className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />,
  },
]

function IconButton({
  label,
  onClick,
  href,
  disabled,
  className,
  children,
}: {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  className: string
  children: React.ReactNode
}) {
  const base =
    'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith('mailto:') ? undefined : '_blank'}
        rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`${base} ${className}`}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${base} ${className}`}
    >
      {children}
    </button>
  )
}

export function ProductShare({ productName }: ProductShareProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [canNativeShare, setCanNativeShare] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '')
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const shareUrl = origin && pathname ? `${origin}${pathname}` : ''

  const shareText = shareUrl
    ? `${productName} — ${shareUrl}`
    : productName

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const copyLink = useCallback(async () => {
    if (!shareUrl) {
      toast.error('Link not ready', { description: 'Refresh the page and try again.' })
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy', { description: 'Copy the address from the bar manually.' })
    }
  }, [shareUrl])

  const nativeShare = useCallback(async () => {
    if (!shareUrl || !canNativeShare) return
    try {
      await navigator.share({
        title: productName,
        text: `Check this out: ${productName}`,
        url: shareUrl,
      })
      setOpen(false)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      toast.error('Could not open share sheet')
    }
  }, [productName, shareUrl, canNativeShare])

  const linkFor = (kind: SocialKind) => {
    if (!shareUrl) return '#'
    const encUrl = encodeURIComponent(shareUrl)
    const encTitle = encodeURIComponent(productName)
    const encText = encodeURIComponent(shareText)
    switch (kind) {
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${encText}`
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`
      case 'x':
        return `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`
      case 'telegram':
        return `https://t.me/share/url?url=${encUrl}&text=${encTitle}`
      case 'email':
        return `mailto:?subject=${encTitle}&body=${encText}`
      default:
        return shareUrl
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Share this product"
      >
        <Share2 className="h-4 w-4" />
        Share
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 sm:right-auto z-30 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-xl border border-divider bg-bg p-3 shadow-lg"
            role="dialog"
            aria-label="Share options"
          >
            <div className="flex items-center gap-2 mb-3">
              {canNativeShare && (
                <IconButton
                  label="Share"
                  onClick={() => void nativeShare()}
                  disabled={!shareUrl}
                  className="bg-deep-teal text-cream border-deep-teal hover:bg-teal"
                >
                  <Share2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                </IconButton>
              )}
              <IconButton
                label={copied ? 'Link copied' : 'Copy link'}
                onClick={() => void copyLink()}
                disabled={!shareUrl}
                className="border-divider text-ink hover:border-teal hover:text-teal"
              >
                {copied ? (
                  <Check className="h-[1.125rem] w-[1.125rem] text-teal" strokeWidth={1.75} />
                ) : (
                  <Link2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                )}
              </IconButton>
            </div>

            <ul className="grid grid-cols-6 gap-2">
              {SOCIAL_LINKS.map(({ kind, label, className, Icon }) => (
                <li key={kind}>
                  <a
                    href={linkFor(kind)}
                    target={kind === 'email' ? undefined : '_blank'}
                    rel={kind === 'email' ? undefined : 'noopener noreferrer'}
                    onClick={() => setOpen(false)}
                    aria-label={label}
                    title={label}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${className}`}
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BrandSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.125rem] w-[1.125rem] fill-current"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <BrandSvg>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </BrandSvg>
  )
}

function TelegramIcon() {
  return (
    <BrandSvg>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </BrandSvg>
  )
}

function FacebookIcon() {
  return (
    <BrandSvg>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </BrandSvg>
  )
}

function XIcon() {
  return (
    <BrandSvg>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </BrandSvg>
  )
}

function LinkedInIcon() {
  return (
    <BrandSvg>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </BrandSvg>
  )
}
