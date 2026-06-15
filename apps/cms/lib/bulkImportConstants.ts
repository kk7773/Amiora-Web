/** Shown on bulk-imported products so admins know to complete the listing in CMS. */
export const BULK_SHORT_DESC_PLACEHOLDER = '[Bulk import — add short description]'

export function isBulkImportPlaceholder(shortDesc: string | null | undefined): boolean {
  if (!shortDesc) return false
  return shortDesc.startsWith('[Bulk import')
}
