import AdmZip from 'adm-zip'
import * as XLSX from 'xlsx'

const XLSX_READ_OPTS: XLSX.ParsingOptions = {
  type: 'buffer',
  raw: false,
  cellStyles: false,
  cellHTML: false,
  cellNF: false,
  bookVBA: false,
  bookDeps: false,
  dense: true,
}

/** Keep only spreadsheet data — images/drawings never needed for bulk import */
const DATA_ONLY_PREFIXES = [
  '[Content_Types].xml',
  '_rels/',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/sharedStrings.xml',
  'xl/styles.xml',
  'xl/theme/',
  'xl/worksheets/sheet',
  'docProps/app.xml',
  'docProps/core.xml',
]

const IMAGE_BINARY_EXT = /\.(png|jpe?g|gif|bmp|emf|wmf|tif|tiff|svg|bin)$/i

function isZipXlsx(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
}

function shouldStripEntry(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower.startsWith('xl/media/')) return true
  if (lower.startsWith('xl/drawings/')) return true
  if (lower.startsWith('xl/embeddings/')) return true
  if (lower.startsWith('xl/printersettings/')) return true
  if (lower.startsWith('xl/richdata/')) return true
  if (lower.startsWith('xl/worksheets/_rels/')) return true
  if (lower.startsWith('xl/charts/')) return true
  if (lower.startsWith('xl/comments/')) return true
  if (lower.startsWith('xl/threadedcomments/')) return true
  if (lower.startsWith('xl/activex/')) return true
  if (lower.startsWith('docprops/thumbnail')) return true
  if (lower.includes('/media/')) return true
  if (lower.includes('drawing') || lower.includes('vml')) return true
  if (IMAGE_BINARY_EXT.test(lower)) return true
  return false
}

function isDataOnlyEntry(name: string): boolean {
  if (shouldStripEntry(name)) return false
  return DATA_ONLY_PREFIXES.some((prefix) => name === prefix || name.startsWith(prefix))
}

/** Strip embedded images, drawings, and image column binaries — import uses text/numbers only */
function stripImagesAndMedia(buffer: Buffer): Buffer {
  const zip = new AdmZip(buffer)
  for (const entry of zip.getEntries()) {
    const name = entry.entryName
    if (shouldStripEntry(name) || !isDataOnlyEntry(name)) {
      zip.deleteFile(name)
    }
  }
  return zip.toBuffer()
}

function tryRead(buffer: Buffer | Uint8Array, type: 'buffer' | 'array'): XLSX.WorkBook {
  return XLSX.read(buffer, { ...XLSX_READ_OPTS, type })
}

/**
 * Parse xlsx/xls — embedded images are stripped first (ignored), only cell data is read.
 */
export function readSpreadsheetWorkbook(buffer: Buffer, filename: string): XLSX.WorkBook {
  const lower = filename.toLowerCase()
  const isCsv = lower.endsWith('.csv')

  if (isCsv) {
    const text = buffer.toString('utf-8')
    return XLSX.read(text, { type: 'string', raw: false })
  }

  if (!isZipXlsx(buffer) && lower.endsWith('.xlsx')) {
    throw new Error('File is not a valid .xlsx (corrupt or incomplete upload). Re-save in Excel and retry.')
  }

  // Always strip images/media first — Image column & embedded photos are not imported
  const dataOnly = isZipXlsx(buffer) ? stripImagesAndMedia(buffer) : buffer

  const attempts: Array<() => XLSX.WorkBook> = [
    () => tryRead(dataOnly, 'buffer'),
    () => tryRead(new Uint8Array(dataOnly), 'array'),
    () => tryRead(buffer, 'buffer'),
    () => tryRead(new Uint8Array(buffer), 'array'),
  ]

  let lastErr: unknown
  for (const attempt of attempts) {
    try {
      return attempt()
    } catch (err: unknown) {
      lastErr = err
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : 'unknown parse error'
  throw new Error(
    `Could not read cell data after ignoring images. ${msg} — try Save As a new .xlsx (max 25 MB).`,
  )
}
