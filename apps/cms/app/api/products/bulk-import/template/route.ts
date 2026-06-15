import { NextResponse } from 'next/server'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'
import { buildBulkImportWorkbook } from '@/lib/bulkImportTemplate'

export async function GET() {
  const isSuper = await isCmsSuperAdminApi()
  if (!isSuper) {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  const buffer = buildBulkImportWorkbook()
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="amiora-product-bulk-import-template.xlsx"',
    },
  })
}
