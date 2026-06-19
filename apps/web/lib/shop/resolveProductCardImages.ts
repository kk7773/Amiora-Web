export type ProductCardImageSlice = {
  url: string
  alt_text: string | null
  is_primary: boolean
  is_hover: boolean
}

type LegacyImage = {
  url: string | null
  alt_text?: string | null
  is_primary?: boolean
  is_hover?: boolean
}

type ColorGroup = {
  images?: (string | { url?: string | null } | null)[] | null
  display_order?: number
  is_active?: boolean
}

function normalizeImageUrl(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (raw && typeof raw === 'object' && 'url' in raw) {
    const url = (raw as { url?: unknown }).url
    return typeof url === 'string' ? url.trim() : ''
  }
  return ''
}

/**
 * Build primary + hover images for product cards.
 * Merges legacy product_images with catalog colour-group images.
 */
export function resolveProductCardImages(
  name: string,
  productImages?: LegacyImage[] | null,
  colorGroups?: ColorGroup[] | null,
): ProductCardImageSlice[] {
  const seen = new Set<string>()
  const ordered: Array<{ url: string; alt_text: string | null; is_primary?: boolean; is_hover?: boolean }> = []

  for (const img of productImages ?? []) {
    const url = normalizeImageUrl(img?.url)
    if (!url || seen.has(url)) continue
    seen.add(url)
    ordered.push({
      url,
      alt_text: img.alt_text ?? null,
      is_primary: img.is_primary,
      is_hover: img.is_hover,
    })
  }

  const groups = [...(colorGroups ?? [])]
    .filter((g) => g.is_active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))

  for (const group of groups) {
    for (const raw of group.images ?? []) {
      const url = normalizeImageUrl(raw)
      if (!url || seen.has(url)) continue
      seen.add(url)
      ordered.push({ url, alt_text: null })
    }
  }

  if (ordered.length === 0) return []

  const primaryIdx = ordered.findIndex((img) => img.is_primary)
  const resolvedPrimaryIdx = primaryIdx >= 0 ? primaryIdx : 0
  const hoverIdx = ordered.findIndex((img) => img.is_hover)
  const resolvedHoverIdx =
    hoverIdx >= 0 ? hoverIdx : ordered.findIndex((_, i) => i !== resolvedPrimaryIdx)

  return ordered.map((img, index) => ({
    url: img.url,
    alt_text: img.alt_text ?? `${name} — image ${index + 1}`,
    is_primary: index === resolvedPrimaryIdx,
    is_hover: resolvedHoverIdx >= 0 && index === resolvedHoverIdx,
  }))
}
