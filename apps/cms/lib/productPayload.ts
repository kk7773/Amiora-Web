/**
 * Drop values Supabase/PostgREST should not see; keep numeric `0` (truthy only for === checks).
 */
export function buildDbProductRow(product: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(product).filter(([, v]) => {
      if (v === undefined) return false
      if (v === '') return false
      if (typeof v === 'number' && Number.isNaN(v)) return false
      return true
    })
  )
}
