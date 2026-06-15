export type StoneLineRecord = {
  name: string
  cut_size: string
  shape: string
  color: string
  count: number | null
  rate_inr: number | null
  price_inr: number | null
}

export function normalizeStoneLines(input: unknown): StoneLineRecord[] {
  if (!Array.isArray(input)) return []
  const out: StoneLineRecord[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    const cut_size = typeof r.cut_size === 'string' ? r.cut_size.trim() : ''
    const shape = typeof r.shape === 'string' ? r.shape.trim() : ''
    const color = typeof r.color === 'string' ? r.color.trim() : ''
    let rate_inr: number | null = null
    if (typeof r.rate_inr === 'number' && Number.isFinite(r.rate_inr)) rate_inr = r.rate_inr
    else if (r.rate_inr != null && r.rate_inr !== '') {
      const n = parseFloat(String(r.rate_inr))
      if (Number.isFinite(n)) rate_inr = n
    }
    let count: number | null = null
    if (typeof r.count === 'number' && Number.isFinite(r.count)) count = Math.floor(r.count)
    else if (r.count != null && r.count !== '') {
      const n = parseInt(String(r.count), 10)
      if (Number.isFinite(n)) count = n
    }
    const price_inr = rate_inr != null && count != null ? rate_inr * count : null
    if (!name && !cut_size && rate_inr == null) continue
    out.push({ name, cut_size, shape, color, count, rate_inr, price_inr })
  }
  return out
}

export function parseOptionalGrams(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}
