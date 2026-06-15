'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Download, FileSpreadsheet, Loader2, Upload, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'

type ImportError = { row: number; design_number: string; message: string }
type ImportWarning = { row: number; design_number: string; message: string }

type ImportResult = {
  imported: number
  failed: number
  errors: ImportError[]
  warnings: ImportWarning[]
  ignoredColumns: string[]
  created: Array<{ design_number: string; productId: string; slug: string }>
}

export function BulkProductUploadClient() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    setFile(picked)
    setResult(null)
    e.target.value = ''
  }, [])

  async function handleImport() {
    if (!file) {
      toast.error('Choose a file first')
      return
    }
    setUploading(true)
    setResult(null)
    setServerError(null)
    try {
      const bytes = await file.arrayBuffer()
      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
          'X-File-Size': String(bytes.byteLength),
        },
        body: bytes,
      })
      const body = (await res.json()) as ImportResult & { error?: string }
      if (!res.ok) {
        const msg = body.error ?? res.statusText
        setServerError(msg)
        throw new Error(msg)
      }
      setResult(body)
      if (body.imported > 0) {
        toast.success(`Imported ${body.imported} product(s)`)
      }
      if (body.failed > 0) {
        toast.error(`${body.failed} product(s) failed — see errors below`)
      }
      if (body.warnings?.length > 0) {
        toast.message(`${body.warnings.length} default(s) applied — see warnings`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Import failed'
      setServerError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-divider p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg text-deep-teal">Upload spreadsheet</h3>
            <p className="text-sm text-ink-muted mt-1 max-w-2xl">
              <strong>Required:</strong> Product Name, Design Number, and net weight (14K Net / 18K Net columns, or metal_weight_g).
              Known optional columns are used when filled; blanks get safe defaults.
              Jo columns system mein defined nahi hain (S.No., Image, C.S. Shape, etc.), wo automatically ignore ho jayenge.
              Embedded Excel photos/images bhi import mein use nahi hote — sirf text/number data read hota hai.
              One row with the same <code className="text-xs bg-surface px-1 rounded">design_number</code> = one product with one default variant.
              Multiple rows with the same design = multiple colour/purity variants.
              Products import as <strong>draft</strong> — complete details and images in CMS before publishing.
            </p>
          </div>
          <a
            href="/api/products/bulk-import/template"
            className="inline-flex items-center gap-2 text-sm text-teal border border-teal px-3 py-2 rounded-lg hover:bg-teal/5 transition-colors shrink-0"
          >
            <Download className="w-4 h-4" /> Download template
          </a>
        </div>

        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-divider rounded-xl p-10 cursor-pointer hover:border-teal/50 hover:bg-surface/30 transition-colors">
          <FileSpreadsheet className="w-10 h-10 text-ink-faint" />
          <span className="text-sm text-ink-muted">
            {file ? file.name : 'Click to choose .xlsx or .csv'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={onFileChange}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={!file || uploading}
          className="inline-flex items-center gap-2 bg-teal text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-deep-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Importing…' : 'Import products'}
        </button>
      </div>

      {serverError && !result && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900">
          <p className="font-medium">Import failed</p>
          <p className="mt-1 text-red-800">{serverError}</p>
          <p className="mt-2 text-xs text-red-700">
            Tip: If Excel has embedded images, open in Excel → remove images → Save As a new .xlsx (max 25 MB), then re-upload.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-900">{result.imported} imported</p>
                {result.created.length > 0 && (
                  <ul className="text-xs text-emerald-800 mt-1 space-y-0.5">
                    {result.created.map((c) => (
                      <li key={c.productId}>
                        <Link href={`/products/${c.productId}`} className="underline hover:text-emerald-950">
                          {c.design_number}
                        </Link>
                        {' '}
                        <span className="text-emerald-700/80">({c.slug})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {result.failed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-sm font-medium text-red-900">{result.failed} failed</p>
              </div>
            )}
          </div>

          {result.ignoredColumns.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-5 py-4 flex items-start gap-3 text-sm text-sky-900">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p>
                Ignored {result.ignoredColumns.length} extra column
                {result.ignoredColumns.length === 1 ? '' : 's'}:{' '}
                <span className="font-mono text-xs text-sky-800">
                  {result.ignoredColumns.join(', ')}
                </span>
              </p>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <h4 className="text-sm font-medium text-amber-900">
                  Warnings ({result.warnings.length}) — defaults applied, edit in CMS
                </h4>
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200 text-left text-xs text-amber-800/80">
                      <th className="px-5 py-2">Row</th>
                      <th className="px-5 py-2">Design #</th>
                      <th className="px-5 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {result.warnings.map((w, i) => (
                      <tr key={`${w.row}-${i}`}>
                        <td className="px-5 py-2 tabular-nums text-amber-900">{w.row}</td>
                        <td className="px-5 py-2 font-mono text-xs text-amber-900">{w.design_number || '—'}</td>
                        <td className="px-5 py-2 text-amber-800">{w.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="bg-white rounded-xl border border-divider overflow-hidden">
              <div className="px-5 py-3 border-b border-divider bg-surface">
                <h4 className="text-sm font-medium text-ink">Errors</h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-divider text-left text-xs text-ink-faint">
                      <th className="px-5 py-2">Row</th>
                      <th className="px-5 py-2">Design #</th>
                      <th className="px-5 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {result.errors.map((err, i) => (
                      <tr key={`${err.row}-${i}`}>
                        <td className="px-5 py-2 tabular-nums">{err.row}</td>
                        <td className="px-5 py-2 font-mono text-xs">{err.design_number || '—'}</td>
                        <td className="px-5 py-2 text-ink-muted">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
