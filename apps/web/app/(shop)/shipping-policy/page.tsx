import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/layout/PolicyLayout'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export const metadata: Metadata = { title: 'Shipping Policy' }

export default function ShippingPolicyPage() {
  return (
    <>
      <StaticPageSchema title="Shipping Policy" path="/shipping-policy" />
    <PolicyLayout
      title="Shipping Policy"
      lastUpdated="April 2025"
      intro="We want your jewellery to reach you safely and swiftly. Here's everything you need to know about our shipping process."
      sections={[
        { heading: 'Free Shipping', body: 'Orders above ₹5,000 qualify for free standard shipping across India. Orders below ₹5,000 incur a flat ₹199 shipping fee.' },
        { heading: 'Processing Time', body: 'Most orders are processed within 1–2 business days. Custom or made-to-order pieces may take 3–4 weeks. You will receive a confirmation email with expected timelines.' },
        { heading: 'Delivery Timelines', body: [
          'Metro cities (Delhi, Mumbai, Bangalore, Chennai): 2–4 business days',
          'Tier 2 & 3 cities: 4–7 business days',
          'Remote locations: 7–10 business days',
          'Express shipping available at checkout (additional charges apply)',
        ]},
        { heading: 'Packaging', body: 'All pieces are shipped in our signature AMIORA jewellery box, wrapped in tissue, inside a secure outer carton with tamper-evident sealing. Each shipment includes a certificate of authenticity.' },
        { heading: 'Order Tracking', body: 'Once shipped, you\'ll receive an email and SMS with a tracking number. Track your order from your account dashboard under "My Orders".' },
        { heading: 'Insurance', body: 'All shipments are fully insured. In case of damage or loss in transit, we will replace the item at no cost to you — no questions asked.' },
      ]}
    />
    </>
  )
}
