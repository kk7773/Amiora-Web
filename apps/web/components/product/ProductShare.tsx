'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Link2, Share2, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type ProductShareProps = {
  productName: string
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
        url:   shareUrl,
      })
      setOpen(false)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      toast.error('Could not open share sheet')
    }
  }, [productName, shareUrl, canNativeShare])

  const linkFor = (kind: 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'telegram' | 'email') => {
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
            className="absolute left-0 right-0 sm:right-auto z-30 mt-2 w-full min-w-[min(100%,18rem)] sm:min-w-[17.5rem] rounded-xl border border-divider bg-bg p-3 shadow-lg"
            role="dialog"
            aria-label="Share options"
          >
            <p className="text-xs uppercase tracking-widest text-ink-faint mb-2">Share this piece</p>

            {canNativeShare && (
              <button
                type="button"
                onClick={() => void nativeShare()}
                disabled={!shareUrl}
                className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 text-sm font-medium rounded-lg bg-deep-teal text-cream hover:bg-teal transition-colors disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                Share…
              </button>
            )}

            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={!shareUrl}
              className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 text-sm rounded-lg border border-divider text-ink hover:border-teal hover:text-teal transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="h-4 w-4 text-teal" /> : <Link2 className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>

            <p className="text-[0.65rem] uppercase tracking-widest text-ink-faint mb-1.5">Apps & social</p>
            <ul className="grid grid-cols-2 gap-1.5 text-xs">
              <li>
                <a
                  href={linkFor('whatsapp')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block py-2 px-2.5 text-center rounded-lg bg-[#25D366]/10 text-ink border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={linkFor('telegram')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block py-2 px-2.5 text-center rounded-lg bg-sky-500/10 text-ink border border-sky-500/30 hover:bg-sky-500/20 transition-colors"
                >
                  Telegram
                </a>
              </li>
              <li>
                <a
                  href={linkFor('facebook')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block py-2 px-2.5 text-center rounded-lg bg-blue-600/10 text-ink border border-blue-600/30 hover:bg-blue-600/20 transition-colors"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href={linkFor('x')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block py-2 px-2.5 text-center rounded-lg bg-ink/5 text-ink border border-ink/15 hover:bg-ink/10 transition-colors"
                >
                  X
                </a>
              </li>
              <li className="col-span-2">
                <a
                  href={linkFor('linkedin')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block py-2 px-2.5 text-center rounded-lg bg-blue-800/10 text-ink border border-blue-800/30 hover:bg-blue-800/20 transition-colors"
                >
                  LinkedIn
                </a>
              </li>
              <li className="col-span-2">
                <a
                  href={linkFor('email')}
                  onClick={() => setOpen(false)}
                  className="block py-2 px-2.5 text-center rounded-lg bg-surface text-ink border border-divider hover:border-teal transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
