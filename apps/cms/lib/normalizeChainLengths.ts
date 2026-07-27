export type ChainLengthRow = {
  length_inch: number
  weight_g: number
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeChainLengths(raw: unknown): ChainLengthRow[] {
  if (!Array.isArray(raw)) return []

  const rows: ChainLengthRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const lengthInch = parseNumber(record.length_inch ?? record.lengthInch)
    const weightG = parseNumber(record.weight_g ?? record.weightG)

    if (lengthInch == null || lengthInch <= 0) continue
    if (weightG == null || weightG <= 0) continue

    rows.push({
      length_inch: Math.round(lengthInch * 1000) / 1000,
      weight_g: Math.round(weightG * 1000) / 1000,
    })
  }

  return rows
}

