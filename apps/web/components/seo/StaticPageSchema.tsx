import { JsonLd } from '@/components/seo/JsonLd'
import { buildWebPageJsonLd } from '@/lib/seo/jsonLd'

type StaticPageSchemaProps = {
  title: string
  description?: string
  path: string
}

/** WebPage JSON-LD for static content routes. */
export function StaticPageSchema({ title, description, path }: StaticPageSchemaProps) {
  return <JsonLd data={buildWebPageJsonLd({ name: title, description, path })} />
}
