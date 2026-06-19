export type AppliesTo = 'making_charge' | 'gem_price' | 'both'

export const APPLIES_TO_LABELS: Record<AppliesTo, string> = {
  making_charge: 'Making charges only',
  gem_price:     'Diamond / Stone only',
  both:          'Making charges + Diamond/Stone',
}
