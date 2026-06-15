import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { isCmsSuperAdminApi } from '@/lib/isCmsSuperAdmin'
import { writeAuditLog } from '@/lib/rbac'
import { createUserSupabase } from '@/lib/supabase/server-user'
import { runBulkProductImport } from '@/lib/bulkProductImport'

export const maxDuration = 300

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

type BulkImportBody = {
  filename?: string
  contentBase64?: string
}

function parseFilename(header: string | null, fallback = 'upload.xlsx'): string {
  if (!header) return fallback
  try {
    return decodeURIComponent(header)
  } catch {
    return header
  }
}

function isAllowedExtension(filename: string): boolean {
  const name = filename.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')
}

async function readUploadBuffer(req: NextRequest): Promise<{ buffer: Buffer; filename: string }> {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = (await req.json()) as BulkImportBody
    const filename = typeof body.filename === 'string' ? body.filename : 'upload.xlsx'
    const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64 : ''
    if (!contentBase64) {
      throw new Error('Missing file content')
    }
    return { buffer: Buffer.from(contentBase64, 'base64'), filename }
  }

  const filename = parseFilename(req.headers.get('x-filename'))
  const arrayBuffer = await req.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), filename }
}

export async function POST(req: NextRequest) {
  const isSuper = await isCmsSuperAdminApi()
  if (!isSuper) {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  try {
    const { buffer, filename } = await readUploadBuffer(req)

    if (!isAllowedExtension(filename)) {
      return NextResponse.json({ error: 'Only .xlsx, .xls, or .csv files are supported' }, { status: 400 })
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }

    const expectedSize = req.headers.get('x-file-size') ?? req.headers.get('content-length')
    if (expectedSize) {
      const expected = parseInt(expectedSize, 10)
      if (Number.isFinite(expected) && expected > 0 && buffer.length !== expected) {
        return NextResponse.json(
          {
            error: `Upload incomplete (${(buffer.length / 1024 / 1024).toFixed(1)} MB received, expected ${(expected / 1024 / 1024).toFixed(1)} MB). Restart CMS dev server and retry.`,
          },
          { status: 400 },
        )
      }
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Remove embedded images and re-save.`,
        },
        { status: 413 },
      )
    }

    const supabase = createServerClient()
    const result = await runBulkProductImport(supabase, buffer, filename)

    const supa = await createUserSupabase()
    const { data: { user } } = await supa.auth.getUser()
    await writeAuditLog({
      adminId: user?.id ?? null,
      action: 'bulk_import_products',
      resource: 'products',
      resourceId: null,
      meta: {
        filename,
        imported: result.imported,
        failed: result.failed,
        warnings: result.warnings.length,
      },
    })

    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error('[bulk-import]', e)
    const message = e instanceof Error ? e.message : 'Server error'
    if (message.includes('Unterminated string') || message.includes('JSON')) {
      return NextResponse.json(
        {
          error:
            'Upload payload too large or corrupted. Save Excel without embedded images, or use a file under 25 MB.',
        },
        { status: 413 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
