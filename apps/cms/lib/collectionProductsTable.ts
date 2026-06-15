/** True when Supabase reports the junction table is missing (migration 020 not applied). */
export function isCollectionProductsTableMissing(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes('collection_products') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    error.code === '42P01'
  )
}
