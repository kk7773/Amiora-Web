/**
 * Comma- or semicolon-separated emails that always have CMS Super Admin
 * (full tabs + Admin Management), without relying on user_metadata in Supabase.
 * MUST be NEXT_PUBLIC_* so middleware + client login can read the same value.
 */
export function listedSuperAdminEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_CMS_SUPER_ADMIN_EMAILS ?? ''
  return raw
    .split(/[,;]|\n/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isListedSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return listedSuperAdminEmails().includes(email.trim().toLowerCase())
}
