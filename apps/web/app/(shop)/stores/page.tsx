import type { Metadata } from 'next'
import { StoresPageClient } from '@/components/stores/StoresPageClient'
import { createServerClient } from '@amiora/database'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildJewelryStoreJsonLd, buildWebPageJsonLd } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'Our Stores',
  description: 'Find an Amiora Diamonds store near you.',
}

export const dynamic = 'force-dynamic'

export default async function StoresPage() {
  const supabase = createServerClient()
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('name')

  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            name: 'AMIORA Stores',
            description: 'Find an Amiora Diamonds store near you.',
            path: '/stores',
          }),
          buildJewelryStoreJsonLd(stores ?? []),
        ]}
      />
      <StoresPageClient stores={stores ?? []} />
    </>
  )
}
