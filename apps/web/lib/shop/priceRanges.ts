export type PriceRangeId =
  | 'under-1000'
  | '1000-2000'
  | '2000-3000'
  | '3000-5000'
  | '5000-10000'
  | '10000-25000'
  | '25000-50000'
  | 'above-50000'

export type PriceRangeBucket = {
  id: PriceRangeId
  label: string
  min: number
  max: number | null
}

export const PRICE_RANGE_BUCKETS: PriceRangeBucket[] = [
  { id: 'under-1000', label: 'Under ₹1,000', min: 0, max: 999 },
  { id: '1000-2000', label: '₹1,000 – ₹2,000', min: 1000, max: 1999 },
  { id: '2000-3000', label: '₹2,000 – ₹3,000', min: 2000, max: 2999 },
  { id: '3000-5000', label: '₹3,000 – ₹5,000', min: 3000, max: 4999 },
  { id: '5000-10000', label: '₹5,000 – ₹10,000', min: 5000, max: 9999 },
  { id: '10000-25000', label: '₹10,000 – ₹25,000', min: 10000, max: 24999 },
  { id: '25000-50000', label: '₹25,000 – ₹50,000', min: 25000, max: 49999 },
  { id: 'above-50000', label: 'Above ₹50,000', min: 50000, max: null },
]

const BUCKET_BY_ID = new Map(PRICE_RANGE_BUCKETS.map((b) => [b.id, b]))

export function parsePriceRangeParam(value: string | undefined | null): PriceRangeBucket | null {
  if (!value) return null
  return BUCKET_BY_ID.get(value as PriceRangeId) ?? null
}

export function matchesPriceRange(basePrice: number, bucket: PriceRangeBucket | null): boolean {
  if (!bucket) return true
  if (basePrice <= 0) return false
  if (bucket.max == null) return basePrice >= bucket.min
  return basePrice >= bucket.min && basePrice <= bucket.max
}
