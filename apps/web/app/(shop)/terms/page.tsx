import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/layout/PolicyLayout'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export const metadata: Metadata = { title: 'Terms & Conditions' }

export default function TermsPage() {
  return (
    <>
      <StaticPageSchema title="Terms & Conditions" path="/terms" />
    <PolicyLayout
      title="Terms & Conditions"
      lastUpdated="April 2025"
      intro="By using the Amiora Diamonds website and purchasing our products, you agree to these terms. Please read them carefully."
      sections={[
        { heading: 'Use of Website', body: 'This website is intended for personal, non-commercial use. You may not reproduce, distribute, or use our content without written permission. AMIORA Diamonds reserves the right to modify or discontinue the service at any time.' },
        { heading: 'Product Information & Pricing', body: 'All prices are shown in Indian Rupees (₹) and include applicable taxes. Prices are live and may fluctuate with gold and silver rates. We reserve the right to cancel an order if pricing errors occur.' },
        { heading: 'Order Acceptance', body: 'Placing an order does not constitute a contract until we confirm it via email. We reserve the right to refuse or cancel any order at our discretion.' },
        { heading: 'Intellectual Property', body: 'All content including images, design, logo, and text is the property of AMIORA Diamonds. Unauthorized use is strictly prohibited.' },
        { heading: 'Limitation of Liability', body: 'AMIORA Diamonds is not liable for indirect or consequential losses arising from the use of our products or services beyond the purchase value of the item in question.' },
        { heading: 'Privacy', body: 'We collect and process personal data as described in our Privacy Policy. We never sell your data to third parties.' },
        { heading: 'Governing Law', body: 'These terms are governed by the laws of India. All disputes shall be subject to the exclusive jurisdiction of courts in New Delhi.' },
        { heading: 'Contact', body: 'For any questions, contact legal@amioradiamonds.com or call +91 98765-43210.' },
      ]}
    />
    </>
  )
}
