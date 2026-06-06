import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/layout/PolicyLayout'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export const metadata: Metadata = { title: 'Return & Refund Policy' }

export default function ReturnPolicyPage() {
  return (
    <>
      <StaticPageSchema title="Return & Refund Policy" path="/return-policy" />
    <PolicyLayout
      title="Return & Refund Policy"
      lastUpdated="April 2025"
      intro="We stand behind every piece we sell. Our 100-day return policy is one of the most generous in the industry."
      sections={[
        { heading: '100-Day Return Window', body: 'You may return any non-customised item within 100 days of delivery for a full refund or exchange — no questions asked.' },
        { heading: 'Eligible Items', body: [
          'Unworn items in original condition with all tags attached',
          'Items accompanied by the original certificate and box',
          'Standard catalogue products (not custom or bespoke orders)',
          'Items purchased online or at an AMIORA store',
        ]},
        { heading: 'Non-Returnable Items', body: [
          'Custom/bespoke designed pieces',
          'Engraved items',
          'Items damaged due to misuse or accidents',
          'Earrings (for hygiene reasons, unless defective)',
        ]},
        { heading: 'How to Return', body: 'Log into your account → My Orders → Select item → Request Return. We\'ll arrange a free pickup within 2 business days. Refund processed within 5–7 business days of receiving the item.' },
        { heading: 'Refund Methods', body: [
          'Original payment method (credit/debit card, UPI): 5–7 business days',
          'Store credit: instant',
          'Bank transfer: 3–5 business days',
        ]},
        { heading: 'Exchange Policy', body: 'Exchanges are free of charge. Choose a different size, metal variant, or product of equal or higher value (pay the difference).' },
      ]}
    />
    </>
  )
}
