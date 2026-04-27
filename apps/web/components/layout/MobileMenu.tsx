'use client'

import Link from 'next/link'
import { X, ChevronDown, ChevronRight, Gem, Sparkles, BookOpen, Phone, FileText, Info, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'

// ── Nav structure ──────────────────────────────────────────────────────────────
const NAV = [
  {
    id: 'collections',
    label: 'Collections',
    icon: <Gem size={18} />,
    type: 'accordion' as const,
    children: [
      { label: 'Rings',           href: '/categories/rings' },
      { label: 'Necklaces',       href: '/categories/necklaces' },
      { label: 'Earrings',        href: '/categories/earrings' },
      { label: 'Bangles',         href: '/categories/bangles' },
      { label: 'Bracelets',       href: '/categories/bracelets' },
      { label: 'Pendants',        href: '/categories/pendants' },
      { label: 'Sets',            href: '/categories/sets' },
    ],
  },
  {
    id: 'customization',
    label: 'Customization',
    icon: <Wand2 size={18} />,
    type: 'link' as const,
    href: '/customization',
  },
  {
    id: 'about',
    label: 'About Us',
    icon: <Info size={18} />,
    type: 'link' as const,
    href: '/about',
  },
  {
    id: 'blogs',
    label: 'Blogs',
    icon: <BookOpen size={18} />,
    type: 'link' as const,
    href: '/blogs',
  },
  {
    id: 'contact',
    label: 'Contact Us',
    icon: <Phone size={18} />,
    type: 'link' as const,
    href: '/contact',
  },
  {
    id: 'policies',
    label: 'Policies',
    icon: <FileText size={18} />,
    type: 'accordion' as const,
    children: [
      { label: 'Shipping Policy', href: '/policies/shipping' },
      { label: 'Return Policy',   href: '/policies/returns' },
      { label: 'Terms of Use',    href: '/policies/terms' },
      { label: 'Privacy Policy',  href: '/policies/privacy' },
    ],
  },
]

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Reset expanded when drawer closes
  useEffect(() => {
    if (!isOpen) setTimeout(() => setExpanded(null), 300)
  }, [isOpen])

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(26,20,16,0.55)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.3s',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          width: '82vw', maxWidth: 340,
          backgroundColor: '#FAF8F5',
          display: 'flex', flexDirection: 'column',
          transition: 'transform 0.32s cubic-bezier(0.16,1,0.3,1)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: '8px 0 40px rgba(26,20,16,0.18)',
        }}
      >
        {/* ── Drawer header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', height: 58,
          backgroundColor: '#285260',
          flexShrink: 0,
        }}>
          <Link
            href="/"
            onClick={onClose}
            style={{ textDecoration: 'none' }}
          >
            <span style={{
              fontFamily: 'Cormorant Garamond, Cormorant, Georgia, serif',
              fontSize: 20, fontWeight: 500,
              letterSpacing: '0.22em', color: '#C9A84C',
            }}>
              AMIORA
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', color: '#C9A84C' }}
          >
            <X size={20} color="#C9A84C" />
          </button>
        </div>

        {/* ── Nav items ── */}
        <nav style={{ overflowY: 'auto', padding: '8px 0', flex: '0 0 auto' }}>
          {NAV.map(item => (
            <div key={item.id}>
              {item.type === 'link' ? (
                /* Direct link */
                <Link
                  href={item.href!}
                  onClick={onClose}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px',
                    color: '#1A1410', textDecoration: 'none',
                    fontSize: 15, fontWeight: 500,
                    borderBottom: '1px solid #EDE9E3',
                  }}
                >
                  <span style={{ color: '#285260', flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                  <span style={{ marginLeft: 'auto', color: '#A8A29C' }}>
                    <ChevronRight size={16} />
                  </span>
                </Link>
              ) : (
                /* Accordion */
                <div>
                  <button
                    onClick={() => toggle(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 20px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      borderBottom: expanded === item.id ? 'none' : '1px solid #EDE9E3',
                      color: '#1A1410', fontSize: 15, fontWeight: 500,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ color: '#285260', flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                    <span style={{
                      marginLeft: 'auto', color: '#285260',
                      transition: 'transform 0.2s',
                      transform: expanded === item.id ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'flex',
                    }}>
                      <ChevronDown size={16} />
                    </span>
                  </button>

                  {/* Sub-items */}
                  <div style={{
                    maxHeight: expanded === item.id ? 600 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s cubic-bezier(0.16,1,0.3,1)',
                    backgroundColor: '#F5F1EC',
                    borderBottom: expanded === item.id ? '1px solid #EDE9E3' : 'none',
                  }}>
                    {item.children?.map(child => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 20px 12px 52px',
                          color: '#6B6560', textDecoration: 'none',
                          fontSize: 14, fontWeight: 400,
                          borderBottom: '1px solid #EDE9E3',
                        }}
                      >
                        {child.label}
                        <ChevronRight size={13} color="#A8A29C" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Spacer — pushes CTAs down without going all the way to bottom */}
        <div style={{ minHeight: 0, flex: '1 1 auto' }} />

        {/* ── Footer CTA ── */}
        <div style={{
          padding: '16px 20px 28px', flexShrink: 0,
          borderTop: '1px solid #EDE9E3',
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 40,
        }}>
          <Link
            href="/account"
            onClick={onClose}
            style={{
              display: 'block', textAlign: 'center',
              padding: '12px 16px', borderRadius: 8,
              backgroundColor: '#285260', color: '#E0D7CF',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
              textDecoration: 'none',
            }}
          >
            Sign In / Register
          </Link>
          <Link
            href="/customization"
            onClick={onClose}
            style={{
              display: 'block', textAlign: 'center',
              padding: '12px 16px', borderRadius: 8,
              border: '1px solid #285260', color: '#285260',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Sparkles size={14} /> Custom Jewellery
            </span>
          </Link>
        </div>
      </div>
    </>
  )
}
