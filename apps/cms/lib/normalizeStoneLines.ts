export type StoneSizeRecord = {
  cut_size: string
  count: number | null
  weight: number | null
  rate_inr: number | null
  price_inr: number | null
}

export type StoneLineRecord = {
  name: string
  shape: string
  color: string
  sizes: StoneSizeRecord[]
  total_weight: number | null
  price_inr: number | null
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === null || value === undefined || value === '') return null
  const parsed = parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  if (value === null || value === undefined || value === '') return null
  const parsed = parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeStoneSizeRows(input: unknown): StoneSizeRecord[] {
  if (!Array.isArray(input)) return []
  const out: StoneSizeRecord[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const cut_size = typeof r.cut_size === 'string' ? r.cut_size.trim() : ''
    const count = parseOptionalInteger(r.count)
    const weight = parseOptionalNumber(r.weight)
    const rate_inr = parseOptionalNumber(r.rate_inr)
    const price_inr = parseOptionalNumber(r.price_inr)
    const computedPrice = price_inr ?? (rate_inr != null && count != null ? rate_inr * count : null)
    if (!cut_size && rate_inr == null && computedPrice == null && weight == null) continue
    out.push({
      cut_size,
      count,
      weight,
      rate_inr,
      price_inr: computedPrice,
    })
  }
  return out
}

export function normalizeStoneLines(input: unknown): StoneLineRecord[] {
  if (!Array.isArray(input)) return []
  const out: StoneLineRecord[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    const shape = typeof r.shape === 'string' ? r.shape.trim() : ''
    const color = typeof r.color === 'string' ? r.color.trim() : ''
    const sizes = normalizeStoneSizeRows(r.sizes)
    const legacyCutSize = typeof r.cut_size === 'string' ? r.cut_size.trim() : ''
    const legacyCount = parseOptionalInteger(r.count)
    const legacyRate = parseOptionalNumber(r.rate_inr)
    const legacyPrice = parseOptionalNumber(r.price_inr)

    const resolvedSizes =
      sizes.length > 0
        ? sizes
        : legacyCutSize || legacyRate != null || legacyPrice != null || legacyCount != null
          ? [{
              cut_size: legacyCutSize,
              count: legacyCount,
              weight: parseOptionalNumber(r.weight),
              rate_inr: legacyRate,
              price_inr: legacyPrice ?? (legacyRate != null && legacyCount != null ? legacyRate * legacyCount : null),
            }]
          : []

    if (!name && resolvedSizes.length === 0) continue

    const totalWeight = resolvedSizes.reduce((total, size) => {
      if (typeof size.weight === 'number' && Number.isFinite(size.weight)) {
        return total + size.weight
      }
      return total
    }, 0)

    const price_inr = resolvedSizes.reduce((total, size) => {
      if (typeof size.price_inr === 'number' && Number.isFinite(size.price_inr)) {
        return total + size.price_inr
      }
      if (size.rate_inr != null && size.count != null) {
        return total + size.rate_inr * size.count
      }
      return total
    }, 0)

    out.push({
      name,
      shape,
      color,
      sizes: resolvedSizes,
      total_weight: totalWeight > 0 ? Math.round(totalWeight * 1000) / 1000 : null,
      price_inr: price_inr > 0 ? Math.round(price_inr * 100) / 100 : null,
    })
  }
  return out
}

export function parseOptionalGrams(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}
