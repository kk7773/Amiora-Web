import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'
import { BulkProductUploadClient } from '@/components/products/BulkProductUploadClient'

export default async function BulkUploadProductsPage() {
  const isSuper = await isCmsSuperAdminApi()
  if (!isSuper) {
    redirect('/products')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-deep-teal">Bulk product upload</h2>
          <p className="text-sm text-ink-muted mt-0.5">Super admin only — import multiple products from Excel or CSV</p>
        </div>
        <Link href="/products" className="text-sm text-teal underline underline-offset-4 shrink-0">
          Back to products
        </Link>
      </div>

      <BulkProductUploadClient />
    </div>
  )
}
