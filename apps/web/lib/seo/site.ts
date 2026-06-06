/** Production site origin for canonical URLs and Open Graph. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.amioradiamonds.in'
  return raw.replace(/\/$/, '')
}

/** Normalize a pathname for canonical (no query, no trailing slash except root). */
export function normalizeCanonicalPath(path: string): string {
  if (!path || path === '/') return '/'
  const trimmed = path.split('?')[0]!.split('#')[0]!.replace(/\/$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Absolute canonical URL for a pathname. */
export function canonicalFromPath(path: string): string {
  const base = getSiteUrl()
  const normalized = normalizeCanonicalPath(path)
  if (normalized === '/') return base
  return `${base}${normalized}`
}
