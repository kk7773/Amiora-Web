import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { createServerClient } from '@amiora/database'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildCollectionListJsonLd, buildWebPageJsonLd } from '@/lib/seo/jsonLd'
import { getCollectionHref } from '@/lib/shop/paths'
import { resolveCollectionImageUrl } from '@/lib/shop/collectionFallbackImages'

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Explore all AMIORA jewellery collections.',
}

export const revalidate = 300

export default async function CollectionsPage() {
  const supabase = createServerClient()
  type CollRow = { id: string; name: string; slug: string; description: string | null; banner_url: string | null }
  const { data: rawCollections } = await supabase
    .from('collections')
    .select('id, name, slug, description, banner_url')
    .eq('is_active', true)
    .order('sort_order')
  const collections = (rawCollections ?? []) as CollRow[]

  const collectionItems = collections.map((col) => ({
    name: col.name,
    slug: col.slug,
    description: col.description,
    image: resolveCollectionImageUrl(col.banner_url, col.slug, col.name),
  }))

  return (
    <div className="section-x py-14">
      <JsonLd
        data={[
          buildWebPageJsonLd({
            name: 'AMIORA Collections',
            description: 'Explore all AMIORA jewellery collections.',
            path: '/collections',
          }),
          buildCollectionListJsonLd({
            name: 'AMIORA Collections',
            path: '/collections',
            items: collectionItems,
          }),
        ]}
      />
      <div className="text-center mb-12">
        <p className="text-2xs uppercase tracking-widest2 text-teal mb-3">Explore</p>
        <h1 className="font-display text-display-2xl text-ink">Our Collections</h1>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-[1.75fr_1fr] md:grid-rows-[repeat(2,minmax(260px,1fr))]">
          {collections[0] && (() => {
            const heroImage = resolveCollectionImageUrl(
              collections[0].banner_url,
              collections[0].slug,
              collections[0].name,
            )
            return (
            <Link
              href={getCollectionHref(collections[0].slug)}
              className="group relative rounded-2xl overflow-hidden bg-surface md:row-span-2 md:min-h-[560px]"
            >
              {heroImage && (
                <Image
                  src={heroImage}
                  alt={collections[0].name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 55vw"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-deep-teal/75 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <h2 className="font-display text-3xl text-white">{collections[0].name}</h2>
                {collections[0].description && (
                  <p className="mt-1 text-sm text-cream/70 line-clamp-2">{collections[0].description}</p>
                )}
              </div>
            </Link>
            )
          })()}

          <div className="grid gap-6 md:grid-cols-2 md:grid-rows-2">
            {collections.slice(1).map((col) => {
              const imageUrl = resolveCollectionImageUrl(col.banner_url, col.slug, col.name)
              return (
              <Link
                key={col.slug}
                href={getCollectionHref(col.slug)}
                className="group relative rounded-2xl overflow-hidden bg-surface min-h-[240px]"
              >
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={col.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-deep-teal/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <h2 className="font-display text-2xl text-white">{col.name}</h2>
                  {col.description && (
                    <p className="mt-1 text-sm text-cream/70 line-clamp-2">{col.description}</p>
                  )}
                </div>
              </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
