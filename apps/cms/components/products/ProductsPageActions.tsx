'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'

export function ProductsPageActions() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d: { cms_role?: string }) => setIsSuperAdmin(d.cms_role === 'super_admin'))
      .catch(() => setIsSuperAdmin(false))
  }, [])

  return (
    <div className="flex items-center gap-2">
      {isSuperAdmin && (
        <Link
          href="/products/bulk-upload"
          className="inline-flex items-center gap-2 border border-teal text-teal px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal/5 transition-colors"
        >
          <Upload className="w-4 h-4" /> Bulk Upload
        </Link>
      )}
      <Link
        href="/products/new"
        className="inline-flex items-center gap-2 bg-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-deep-teal transition-colors"
      >
        <Plus className="w-4 h-4" /> Add Product
      </Link>
    </div>
  )
}
