const COLLECTION_FALLBACK_IMAGES: Record<string, string> = {
  bridal: 'https://res.cloudinary.com/dqayol6fn/image/upload/v1782816050/website_aecwsj.png',
  everyday: 'https://res.cloudinary.com/dqayol6fn/image/upload/v1782816150/Website_d2no5r.png',
  gift: 'https://res.cloudinary.com/dqayol6fn/image/upload/v1782816358/Website_ee2ep2.png',
  'gift-sets': 'https://res.cloudinary.com/dqayol6fn/image/upload/v1782816358/Website_ee2ep2.png',
  'office-wear': 'https://res.cloudinary.com/dqayol6fn/image/upload/v1782816613/ChatGPT_Image_Jun_29_2026_06_39_56_PM_pgeint.png',
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
