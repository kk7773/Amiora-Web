import type { Metadata } from 'next'
import { CustomizationPageClient } from '@/components/forms/CustomizationForm'
import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export const metadata: Metadata = {
  title: 'Custom Jewellery',
  description: 'Design your dream jewellery piece with Amiora Diamonds.',
}

export default function CustomizationPage() {
  return (
    <>
      <StaticPageSchema
        title="Custom Jewellery"
        description="Design your dream jewellery piece with Amiora Diamonds."
        path="/customization"
      />
      <CustomizationPageClient />
    </>
  )
}
