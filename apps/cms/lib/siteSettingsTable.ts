/** True when Supabase reports the site_settings table is missing. */
export function isSiteSettingsTableMissing(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes('site_settings') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    error.code === '42P01'
  )
}
