import type { Metadata } from 'next'
import { canonicalFromPath } from '@/lib/seo/site'

type PageMetadataInput = {
  title?: string
  description?: string
  path: string
  openGraph?: Metadata['openGraph']
  twitter?: Metadata['twitter']
  robots?: Metadata['robots']
}

/** Page metadata with a canonical URL derived from `path`. */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const canonical = canonicalFromPath(input.path)
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.description ? { description: input.description } : {}),
    alternates: { canonical },
    ...(input.openGraph
      ? { openGraph: { ...input.openGraph, url: canonical } }
      : {}),
    ...(input.twitter ? { twitter: input.twitter } : {}),
    ...(input.robots ? { robots: input.robots } : {}),
  }
}
