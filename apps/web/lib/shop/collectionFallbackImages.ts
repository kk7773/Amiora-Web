const COLLECTION_FALLBACK_IMAGES: Record<string, string> = {
  bridal: '/website_Bridal.avif',
  everyday: '/Website_Everyday.avif',
  gift: '/Website_Gift.avif',
  'gift-sets': '/Website_Gift.avif',
  'office-wear': '/Website_Office_Wear.avif',
  all: 'https://res.cloudinary.com/dqayol6fn/image/upload/v1782816698/ChatGPT_Image_Jun_29_2026_06_35_54_PM_gbszzb.png',
  'all-collections': 'https://res.cloudinary.com/dqayol6fn/image/upload/v1782816698/ChatGPT_Image_Jun_29_2026_06_35_54_PM_gbszzb.png',
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
  const slugKey = normCollectionKey(slug)
  const nameKey = name ? normCollectionKey(name) : ''
  const curatedImage =
    COLLECTION_FALLBACK_IMAGES[slugKey] ??
    COLLECTION_FALLBACK_IMAGES[nameKey] ??
    (nameKey.includes('office') ? COLLECTION_FALLBACK_IMAGES['office-wear'] : null) ??
    (nameKey.includes('gift') ? COLLECTION_FALLBACK_IMAGES['gift-sets'] : null)

  if (curatedImage) return curatedImage
  if (bannerOrThumbUrl?.trim()) return bannerOrThumbUrl.trim()

  return (
    COLLECTION_FALLBACK_IMAGES[slugKey] ??
    COLLECTION_FALLBACK_IMAGES[nameKey] ??
    (nameKey.includes('office') ? COLLECTION_FALLBACK_IMAGES['office-wear'] : null) ??
    (nameKey.includes('gift') ? COLLECTION_FALLBACK_IMAGES['gift-sets'] : null)
  )
}
