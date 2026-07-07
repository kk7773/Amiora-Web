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
        lastUpdated="July 2026"
        intro="Amiora provides a Lifetime Buy-Back and Exchange Policy on all eligible purchases, subject to product inspection, prevailing market value, applicable deductions, and category-specific conditions."
        sections={[
          {
            heading: 'Lifetime Buy-Back and Exchange',
            body: [
              'Eligible products may be returned with the original certificate for buy-back or exchange based on prevailing market value.',
              'Making charges, applicable taxes, a processing fee of Rs. 1,000, and any discount or complimentary gift value received at purchase will be deducted where applicable.',
              'Jewellery altered by anyone other than Amiora is not eligible for buy-back or exchange.',
              'Amiora may revise the assessed value after quality inspection with a stated justification.',
            ],
          },
          {
            heading: 'Lifetime Exchange',
            body: [
              'Exchange value is credited to your Amiora account and can be used to purchase another product.',
              'Exchange value cannot be encashed.',
              'A design can be exchanged for full value only once. A second exchange request is treated under the lifetime buy-back policy.',
              'Products that are engraved, personalised, or customised are not eligible under the return policy.',
            ],
          },
          {
            heading: 'Product Condition Requirements',
            body: [
              'Product must be returned in original packaging in saleable condition.',
              'No scratches, damage, wear, or alteration should be present.',
              'Stickers and tags must remain intact.',
              'If product tag or packaging is tampered with, the request will be processed under buy-back policy or post quality-control inspection.',
            ],
          },
          {
            heading: 'Exchange and Buy-Back Values by Category',
            body: [
              'Gold and Diamond Jewellery: Exchange at 100% gold value on billed amount and 100% diamond value at current market rate; Buy-back at 90% gold value and 90% diamond value at current market rate. GST and making charge deductions apply as per conditions.',
              'Plain Gold Jewellery: Exchange and buy-back at 100% of gold value at current market rate.',
              'Coins: Exchange and buy-back at 100% of gold or silver value at current market rate.',
              'Nosepin: Eligible for exchange only, not for buy-back.',
              '9KT Gold-Diamond Jewellery: Exchange at 100% gold value on billed value and 100% diamond value at current market rate; Buy-back at 85% of current silver value and 90% of diamond value at current market rate. GST and making charge deductions apply as per conditions.',
              '925 Silver Jewellery: Exchange at 100% silver value on billed value and 100% diamond value at current market rate; Buy-back at 90% silver value at current market rate and 90% diamond value at current market rate. GST and making charge deductions apply as per conditions.',
              'LUNA by Amiora (Vermeil): Exchange at 100% billed metal value and 100% diamond value at current market rate. Buy-back is not available.',
            ],
          },
          {
            heading: 'Not Eligible',
            body: [
              'Loose diamonds',
              'Polkis, pearls, and coloured stones',
              'Products purchased from sources other than Amiora stores or the official Amiora website',
            ],
          },
          {
            heading: 'Additional Conditions',
            body: [
              'Original invoice and certificate are mandatory for processing buy-back or exchange.',
              'If the certificate is lost, an additional fee of Rs. 2,000 or Rs. 750 per carat, whichever is higher, will apply.',
              'Discounts on metal, diamonds, stones, or making charges used at purchase will be deducted from prevailing market value before final calculation.',
              'Any e-points, rewards, or benefits used during purchase will be subtracted from buy-back or exchange value.',
              'Buy-back is applicable only for products originally purchased at a value up to Rs. 1,99,999.',
              'Logistic charges are borne by the customer.',
            ],
          },
          {
            heading: 'Refund and Settlement',
            body: [
              'Buy-back value is paid via bank transfer within 14 business working days of receipt of the product or completion of quality control check.',
              'For cash on delivery orders, refund will be processed to your bank account.',
              'For prepaid orders, refund will be credited to the original payment source such as credit card, debit card, net banking, or UPI.',
            ],
          },
          {
            heading: 'How to Return Your Product',
            body: [
              'Place a return request by visiting your nearest Amiora Diamonds store or by emailing info@amioradiamonds.com.',
              'Customer support will assist in placing a return from your location.',
              'A sale return voucher will be issued by Amiora and becomes invalid after payment.',
              'Share KYC details of the purchaser and bank account details.',
              'Product will go through quality control and final value will be decided after inspection.',
              'Refund will be initiated within 14 business working days.',
            ],
          },
          {
            heading: 'Policy Changes',
            body: 'Amiora reserves the right to modify these policies at any time. Changes take effect immediately, so please review this policy periodically.',
          },
          // {
          //   heading: 'Registered Office',
          //   body: [
          //     '3N Ram Krishna Naskar Lane',
          //     'Beliaghata, Kolkata, West Bengal 700010',
          //     'Phone: +91-98300-14477 / +91-90889-89888',
          //   ],
          // },
        ]}
      />
    </>
  )
}
