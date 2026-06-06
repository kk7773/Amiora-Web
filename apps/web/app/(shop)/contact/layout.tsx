import { StaticPageSchema } from '@/components/seo/StaticPageSchema'

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaticPageSchema
        title="Contact AMIORA"
        description="Get in touch with AMIORA Jewellery for orders, custom designs, and support."
        path="/contact"
      />
      {children}
    </>
  )
}
