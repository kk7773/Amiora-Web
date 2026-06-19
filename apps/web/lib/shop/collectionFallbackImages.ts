const COLLECTION_FALLBACK_IMAGES: Record<string, string> = {
  bridal: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=80',
  everyday: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80',
  'office-wear': 'https://images.unsplash.com/photo-1627293509201-cd0a9fce9fca?auto=format&fit=crop&w=1200&q=80',
  'gift-sets': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
}

export function normCollectionKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Banner/thumb URL with slug-based Unsplash fallbacks when CMS field is empty. */
export function resolveCollectionImageUrl(
  bannerOrThumbUrl: string | null | undefined,
  slug: string,
  name?: string,
): string | null {
  if (bannerOrThumbUrl?.trim()) return bannerOrThumbUrl.trim()

  const slugKey = normCollectionKey(slug)
  const nameKey = name ? normCollectionKey(name) : ''

  return (
    COLLECTION_FALLBACK_IMAGES[slugKey] ??
    COLLECTION_FALLBACK_IMAGES[nameKey] ??
    (nameKey.includes('office') ? COLLECTION_FALLBACK_IMAGES['office-wear'] : null)
  )
}
