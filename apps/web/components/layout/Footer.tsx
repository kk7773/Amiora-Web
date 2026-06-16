import Link from 'next/link'

const SOCIAL = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/amioradiamonds?igsh=eGZvaGxsYWYyN2g1',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/amiora-diamonds/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M20.447 20.452H16.89v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.346V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.268 2.37 4.268 5.455v6.286zM5.337 7.433a2.063 2.063 0 11.001-4.126 2.063 2.063 0 01-.001 4.126zM7.119 20.452H3.556V9H7.12v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/1NxqjA6SAU/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  // {
  //   label: 'X (Twitter)',
  //   href: 'https://x.com',
  //   icon: (
  //     <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
  //       <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  //     </svg>
  //   ),
  // },
]

const SHOP_LINKS = ['Rings','Necklaces','Earrings','Bangles','Bracelets','Pendants','Sets']
const POLICY_LINKS = [
  { label: 'About Us',        href: '/about' },
  { label: 'Blogs',           href: '/blogs' },
  { label: 'Stores',          href: '/stores' },
  { label: 'Customization',   href: '/customization' },
  { label: 'Shipping Policy', href: '/shipping-policy' },
  { label: 'Return Policy',   href: '/return-policy' },
  { label: 'Terms of Use',    href: '/terms' },
]

export function Footer() {
  return (
    <footer className="bg-deep-teal text-cream/80">
      {/* Main grid */}
      <div className="section-x py-16 grid gap-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

        {/* Brand column — full width on mobile */}
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-3xl text-cream tracking-widest mb-4">AMIORA</p>
          <p className="text-sm leading-relaxed text-cream/60 max-w-xs">
            Handcrafted jewellery with live gold & silver pricing. BIS Hallmarked, certified diamonds,
            free shipping across India.
          </p>
          <div className="mt-6 flex gap-4">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="text-cream/50 hover:text-cream transition-colors"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Shop + Company — side by side on mobile, separate columns on lg */}
        <div className="sm:col-span-2 lg:col-span-2 grid grid-cols-2 gap-8">
          {/* Shop */}
          <div>
            <h4 className="mb-4 text-2xs uppercase tracking-widest2 text-gold">Shop</h4>
            <ul className="space-y-2.5">
              {SHOP_LINKS.map((item) => (
                <li key={item}>
                  <Link
                    href={`/shop/${item.toLowerCase()}`}
                    className="text-sm text-cream/60 hover:text-cream transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-2xs uppercase tracking-widest2 text-gold">Company</h4>
            <ul className="space-y-2.5">
              {POLICY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-cream/60 hover:text-cream transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contact — centered on mobile */}
        <div className="sm:col-span-2 lg:col-span-1 text-center lg:text-left">
          <h4 className="mb-4 text-2xs uppercase tracking-widest2 text-gold">Contact</h4>
          <address className="not-italic space-y-3 text-sm text-cream/60">
            <p>+91 98765-43210</p>
            <p>hello@amioradiamonds.com</p>
            <p className="leading-relaxed">
              123 Jewellery District,<br />
              New Delhi — 110001, India
            </p>
          </address>
          <Link
            href="/stores"
            className="mt-4 inline-block text-xs uppercase tracking-widest text-gold hover:text-gold-light transition-colors"
          >
            Find Our Stores →
          </Link>
        </div>

      </div>

      {/* Bottom bar */}
      <div className="border-t border-cream/10 section-x py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cream/40">
        <p>© {new Date().getFullYear()} Amiora Diamonds. All rights reserved.</p>
        <p>Designed with ♥ in India · BIS Hallmarked · 100-Day Returns</p>
      </div>
    </footer>
  )
}
