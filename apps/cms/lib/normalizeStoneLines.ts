export type StoneSizeRecord = {
  cut_size: string
  count: number | null
  weight: number | null
  price_per_carat_inr: number | null
  rate_inr: number | null
  price_inr: number | null
}

export type StoneLineRecord = {
  stone_type?: 'diamond' | 'other_than_diamond' | null
  name: string
  shape: string
  color: string
  sizes: StoneSizeRecord[]
  total_weight: number | null
  price_inr: number | null
}

function normalizeStoneType(value: unknown): 'diamond' | 'other_than_diamond' | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'diamond') return 'diamond'
  if (
    normalized === 'other_than_diamond' ||
    normalized === 'other than diamond' ||
    normalized === 'other-than-diamond'
  ) {
    return 'other_than_diamond'
  }
  return null
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
    const price_per_carat_inr = parseOptionalNumber(r.price_per_carat_inr)
    const rate_inr = parseOptionalNumber(r.rate_inr)
    const price_inr = parseOptionalNumber(r.price_inr)
    const resolvedRate = price_per_carat_inr ?? rate_inr
    const computedPrice =
      price_inr ??
      (resolvedRate != null && weight != null ? resolvedRate * weight : null) ??
      (rate_inr != null && count != null ? rate_inr * count : null)
    if (!cut_size && resolvedRate == null && computedPrice == null && weight == null) continue
    out.push({
      cut_size,
      count,
      weight,
      price_per_carat_inr: resolvedRate,
      rate_inr: resolvedRate,
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
    const stone_type = normalizeStoneType(r.stone_type ?? r.name)
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    const shape = typeof r.shape === 'string' ? r.shape.trim() : ''
    const color = typeof r.color === 'string' ? r.color.trim() : ''
    const sizes = normalizeStoneSizeRows(r.sizes)
    const legacyCutSize = typeof r.cut_size === 'string' ? r.cut_size.trim() : ''
    const legacyCount = parseOptionalInteger(r.count)
    const legacyPricePerCarat = parseOptionalNumber(r.price_per_carat_inr)
    const legacyRate = parseOptionalNumber(r.rate_inr)
    const legacyPrice = parseOptionalNumber(r.price_inr)

    const resolvedSizes =
      sizes.length > 0
        ? sizes
        : legacyCutSize || legacyPricePerCarat != null || legacyRate != null || legacyPrice != null || legacyCount != null
          ? [{
              cut_size: legacyCutSize,
              count: legacyCount,
              weight: parseOptionalNumber(r.weight),
              price_per_carat_inr: legacyPricePerCarat ?? legacyRate,
              rate_inr: legacyPricePerCarat ?? legacyRate,
              price_inr:
                legacyPrice ??
                ((legacyPricePerCarat ?? legacyRate) != null && parseOptionalNumber(r.weight) != null
                  ? (legacyPricePerCarat ?? legacyRate)! * parseOptionalNumber(r.weight)!
                  : null) ??
                (legacyRate != null && legacyCount != null ? legacyRate * legacyCount : null),
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
      if (size.price_per_carat_inr != null && size.weight != null) {
        return total + size.price_per_carat_inr * size.weight
      }
      if (size.rate_inr != null && size.count != null) {
        return total + size.rate_inr * size.count
      }
      return total
    }, 0)

    out.push({
      stone_type,
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
