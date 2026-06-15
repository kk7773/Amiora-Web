export type AuditLink = {
  kind: 'cms' | 'storefront'
  label: string
  href: string
  external?: boolean
  note?: string
}

export type ResourceSnapshot =
  | {
      type: 'product'
      id: string
      name: string
      slug: string
      status: string
      design_number: string | null
    }
  | {
      type: 'collection'
      id: string
      name: string
      slug: string
      is_active: boolean
    }
  | {
      type: 'blog'
      id: string
      title: string
      slug: string
      status: string | null
    }
  | {
      type: 'order'
      id: string
      order_number: string | null
      status: string | null
    }

export const META_FIELD_LABELS: Record<string, string> = {
  imported: 'Products imported',
  failed: 'Rows failed',
  filename: 'Excel file',
  warnings: 'Warnings',
  status: 'Status',
  gold: 'Gold rate',
  silver: 'Silver rate',
  table: 'Request table',
  tabs: 'Tab permissions',
  name: 'Name',
  email: 'Email',
}

export function formatMetaEntries(
  meta: Record<string, unknown> | null,
): Array<{ key: string; label: string; value: string }> {
  if (!meta) return []
  return Object.entries(meta).map(([key, value]) => ({
    key,
    label: META_FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
  }))
}
