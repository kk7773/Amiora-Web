import { canonicalFromPath, getSiteUrl } from '@/lib/seo/site'

export interface BreadcrumbItem {
  name: string
  href: string
}

export type SchemaProductItem = {
  name: string
  slug: string
  image?: string | null
  price?: number | null
}

export type SchemaCollectionItem = {
  name: string
  slug: string
  description?: string | null
  image?: string | null
}

const BRAND = { '@type': 'Brand' as const, name: 'AMIORA' }

export function productCanonicalUrl(slug: string) {
  return canonicalFromPath(`/products/${slug}`)
}

/** Map live-priced catalogue rows into schema list items. */
export function toSchemaProductItem(product: {
  name: string
  slug: string
  basePrice?: number
  product_images?: { url: string; is_primary?: boolean }[] | null
}): SchemaProductItem {
  const images = product.product_images ?? []
  const image = images.find((i) => i.is_primary)?.url ?? images[0]?.url ?? null
  return {
    name: product.name,
    slug: product.slug,
    image,
    price: product.basePrice && product.basePrice > 0 ? product.basePrice : null,
  }
}

export function buildOrganizationJsonLd() {
  const site = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AMIORA Jewellery',
    url: site,
    logo: `${site}/logo.png`,
    sameAs: [
      'https://www.instagram.com/amiorajewellery',
      'https://www.facebook.com/amiorajewellery',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-XXXXXXXXXX',
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
  }
}

export function buildWebSiteJsonLd() {
  const site = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AMIORA Jewellery',
    url: site,
    publisher: { '@type': 'Organization', name: 'AMIORA Jewellery', url: site },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildWebPageJsonLd({
  name,
  description,
  path,
}: {
  name: string
  description?: string
  path: string
}) {
  const url = canonicalFromPath(path)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    ...(description ? { description } : {}),
    url,
    isPartOf: { '@type': 'WebSite', name: 'AMIORA Jewellery', url: getSiteUrl() },
  }
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalFromPath(item.href),
    })),
  }
}

function productListElements(items: SchemaProductItem[], startPosition = 1) {
  return items.map((item, index) => ({
    '@type': 'ListItem' as const,
    position: startPosition + index,
    item: {
      '@type': 'Product' as const,
      name: item.name,
      url: productCanonicalUrl(item.slug),
      brand: BRAND,
      ...(item.image ? { image: item.image } : {}),
      ...(item.price
        ? {
            offers: {
              '@type': 'Offer' as const,
              price: item.price.toFixed(2),
              priceCurrency: 'INR',
              availability: 'https://schema.org/InStock',
              url: productCanonicalUrl(item.slug),
            },
          }
        : {}),
    },
  }))
}

export function buildItemListJsonLd({
  name,
  path,
  items,
  total,
}: {
  name: string
  path: string
  items: SchemaProductItem[]
  total?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: canonicalFromPath(path),
    numberOfItems: total ?? items.length,
    itemListElement: productListElements(items),
  }
}

export function buildCollectionListJsonLd({
  name,
  path,
  items,
}: {
  name: string
  path: string
  items: SchemaCollectionItem[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: canonicalFromPath(path),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'CollectionPage',
        name: item.name,
        url: canonicalFromPath(`/collections/${item.slug}`),
        ...(item.description ? { description: item.description } : {}),
        ...(item.image ? { image: item.image } : {}),
      },
    })),
  }
}

export function buildCollectionPageJsonLd({
  name,
  description,
  path,
  image,
  products,
  total,
}: {
  name: string
  description?: string | null
  path: string
  image?: string | null
  products: SchemaProductItem[]
  total?: number
}) {
  const url = canonicalFromPath(path)
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    ...(description ? { description } : {}),
    url,
    ...(image ? { image } : {}),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total ?? products.length,
      itemListElement: productListElements(products),
    },
  }
}

export function buildProductJsonLd({
  name,
  description,
  image,
  slug,
  price,
  sku,
  reviewCount,
  avgRating,
  categoryName,
  collectionName,
}: {
  name: string
  description: string
  image?: string
  slug: string
  price?: number
  sku?: string | null
  reviewCount?: number
  avgRating?: number
  categoryName?: string | null
  collectionName?: string | null
}) {
  const url = productCanonicalUrl(slug)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: image ?? '',
    url,
    brand: BRAND,
    ...(sku ? { sku } : {}),
    ...(categoryName ? { category: categoryName } : {}),
    ...(collectionName ? { isRelatedTo: { '@type': 'Collection', name: collectionName } } : {}),
    ...(price && price > 0
      ? {
          offers: {
            '@type': 'Offer',
            price: price.toFixed(2),
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            url,
          },
        }
      : {}),
    ...(reviewCount && avgRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating.toFixed(1),
            reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
}

export function buildProductPageSchemas({
  product,
  breadcrumb,
  faqs,
}: {
  product: Parameters<typeof buildProductJsonLd>[0]
  breadcrumb: BreadcrumbItem[]
  faqs?: { question: string; answer: string }[]
}) {
  const schemas: Record<string, unknown>[] = [
    buildProductJsonLd(product),
    buildBreadcrumbJsonLd(breadcrumb),
  ]
  if (faqs?.length) schemas.push(buildFaqPageJsonLd(faqs))
  return schemas
}

export function buildFaqPageJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }
}

export function buildBlogPostingJsonLd({
  title,
  description,
  slug,
  image,
  author,
  publishedAt,
  tags,
}: {
  title: string
  description?: string | null
  slug: string
  image?: string | null
  author: string
  publishedAt?: string | null
  tags?: string[] | null
}) {
  const url = canonicalFromPath(`/blogs/${slug}`)
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    ...(description ? { description } : {}),
    url,
    mainEntityOfPage: url,
    ...(image ? { image } : {}),
    author: { '@type': 'Person', name: author },
    publisher: {
      '@type': 'Organization',
      name: 'AMIORA Jewellery',
      logo: { '@type': 'ImageObject', url: `${getSiteUrl()}/logo.png` },
    },
    ...(publishedAt ? { datePublished: publishedAt } : {}),
    ...(tags?.length ? { keywords: tags.join(', ') } : {}),
  }
}

export function buildBlogListJsonLd(
  posts: { title: string; slug: string; excerpt?: string | null; cover_url?: string | null; published_at?: string | null }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AMIORA Journal',
    url: canonicalFromPath('/blogs'),
    numberOfItems: posts.length,
    itemListElement: posts.map((post, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'BlogPosting',
        headline: post.title,
        url: canonicalFromPath(`/blogs/${post.slug}`),
        ...(post.excerpt ? { description: post.excerpt } : {}),
        ...(post.cover_url ? { image: post.cover_url } : {}),
        ...(post.published_at ? { datePublished: post.published_at } : {}),
      },
    })),
  }
}

export function buildSearchResultsJsonLd({
  query,
  items,
}: {
  query: string
  items: SchemaProductItem[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    name: `Search results for "${query}"`,
    url: canonicalFromPath(`/search?q=${encodeURIComponent(query)}`),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: productListElements(items),
    },
  }
}

export function buildJewelryStoreJsonLd(
  stores: {
    name: string
    address?: string | null
    city?: string | null
    state?: string | null
    pincode?: string | null
    phone?: string | null
    lat?: number | null
    lng?: number | null
  }[],
) {
  const site = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'JewelryStore',
    name: 'AMIORA Jewellery',
    url: site,
    image: `${site}/logo.png`,
    priceRange: '₹₹₹',
    telephone: '+91-XXXXXXXXXX',
    '@graph': stores.map((store) => ({
      '@type': 'LocalBusiness',
      name: `AMIORA — ${store.name}`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: store.address ?? '',
        addressLocality: store.city ?? '',
        addressRegion: store.state ?? '',
        postalCode: store.pincode ?? '',
        addressCountry: 'IN',
      },
      ...(store.lat && store.lng
        ? { geo: { '@type': 'GeoCoordinates', latitude: store.lat, longitude: store.lng } }
        : {}),
      telephone: store.phone ?? '',
    })),
  }
}

export function buildListingPageSchemas({
  pageType = 'WebPage',
  name,
  description,
  path,
  breadcrumb,
  products,
  total,
  image,
}: {
  pageType?: 'WebPage' | 'CollectionPage'
  name: string
  description?: string
  path: string
  breadcrumb: BreadcrumbItem[]
  products: SchemaProductItem[]
  total?: number
  image?: string | null
}) {
  const pageSchema =
    pageType === 'CollectionPage'
      ? buildCollectionPageJsonLd({
          name,
          description,
          path,
          image,
          products,
          total,
        })
      : buildWebPageJsonLd({ name, description, path })

  return [
    pageSchema,
    buildBreadcrumbJsonLd(breadcrumb),
    buildItemListJsonLd({ name, path, items: products, total }),
  ]
}
