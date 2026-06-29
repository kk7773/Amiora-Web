import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { slugifyName } from '@/lib/sku'
import { createCatalogProduct } from '@/lib/createCatalogProduct'
import type { CatalogProductPayload, ColorVariantIn, MatrixCell } from '@/lib/catalogProductTypes'
import { PRODUCTS_HEADERS } from '@/lib/bulkImportTemplate'
import { BULK_SHORT_DESC_PLACEHOLDER } from '@/lib/bulkImportConstants'
import { readSpreadsheetWorkbook } from '@/lib/xlsxResilientRead'

export type BulkImportRowError = {
  row: number
  design_number: string
  message: string
}

export type BulkImportWarning = {
  row: number
  design_number: string
  message: string
}

export type BulkImportResult = {
  imported: number
  failed: number
  errors: BulkImportRowError[]
  warnings: BulkImportWarning[]
  ignoredColumns: string[]
  created: Array<{ design_number: string; productId: string; slug: string }>
}

type RawRow = Record<string, unknown>

type MasterLookups = {
  categories: Map<string, string>
  categoriesByName: Map<string, string>
  defaultCategoryId: string
  defaultCategoryCode: string
  collections: Map<string, string>
  colors: Map<string, { id: string; code: string }>
  purities: Map<string, { id: string; code: string; metal: string }>
  existingSlugs: Set<string>
  existingDesignNumbers: Set<string>
  nextProductNumberByCategory: Map<string, number>
}

const COLUMN_ALIASES: Record<string, string> = {
  design_no: 'design_number',
  design_num: 'design_number',
  design: 'design_number',
  product_name: 'name',
  product: 'name',
  title: 'name',
  category: 'category_code',
  metal: 'base_metal',
  colour_code: 'color_code',
  colour: 'color_code',
  purity: 'purity_code',
  weight_g: 'metal_weight_g',
  weight: 'metal_weight_g',
  metal_weight: 'metal_weight_g',
  net_weight: 'metal_weight_g',
  net_wt: 'metal_weight_g',
  stock: 'stock_qty',
  qty: 'stock_qty',
  quantity: 'stock_qty',
  diamond_pc: 'diamond_count',
  total_diamond_pc: 'diamond_count',
  diamond_wt: 'total_diamond_wt',
  remark: 'short_desc',
  remarks: 'short_desc',
}

/** Vendor sheets: one row with 14K / 18K / 22K net columns → multiple variants */
const PURITY_NET_COLUMNS: Record<string, string> = {
  '22k_net': '22',
  '09k_net': '09',
  '9k_net': '09',
  '14k_net': '14',
  '18k_net': '18',
  '925_net': '925',
  '835_net': '835',
}
const PURITY_NET_KEYS = Object.keys(PURITY_NET_COLUMNS)

const STONE_FIELD_SUFFIXES = ['name', 'cut_size', 'shape', 'color', 'count', 'rate_inr'] as const
const STONE_HELPER_KEYS = ([2, 3] as const).flatMap((n) =>
  STONE_FIELD_SUFFIXES.map((suffix) => `stone_${n}_${suffix}`),
)

const KNOWN_IMPORT_KEYS = new Set<string>([
  ...PRODUCTS_HEADERS,
  ...Object.keys(COLUMN_ALIASES),
  ...STONE_HELPER_KEYS,
  ...PURITY_NET_KEYS,
])

const CANONICAL_ROW_KEYS = new Set<string>([
  ...PRODUCTS_HEADERS,
  ...STONE_HELPER_KEYS,
  ...PURITY_NET_KEYS,
])

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .replace(/[#]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function filterToKnownColumns(row: RawRow): RawRow {
  const out: RawRow = {}
  for (const key of CANONICAL_ROW_KEYS) {
    if (key in row) out[key] = row[key]
  }
  return out
}

function normalizeRow(raw: Record<string, unknown>, ignoredAccumulator: Set<string>): RawRow {
  const out: RawRow = {}
  for (const [k, v] of Object.entries(raw)) {
    const nk = normalizeKey(k)
    if (!KNOWN_IMPORT_KEYS.has(nk)) {
      const label = k.trim()
      if (label) ignoredAccumulator.add(label)
      continue
    }
    out[nk] = v
  }
  return filterToKnownColumns(applyColumnAliases(out))
}

function applyColumnAliases(row: RawRow): RawRow {
  const out = { ...row }
  for (const [from, to] of Object.entries(COLUMN_ALIASES)) {
    if (cellStr(out[to]) === '' && cellStr(out[from]) !== '') {
      out[to] = out[from]
    }
  }
  if (cellStr(out.design_number) === '' && cellStr(out.slug) !== '') {
    out.design_number = out.slug
  }
  return out
}

function isNonEmptyRow(row: RawRow): boolean {
  return Object.values(row).some((v) => cellStr(v) !== '')
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function parseYn(v: unknown, defaultVal = false): boolean {
  const s = cellStr(v).toLowerCase()
  if (!s) return defaultVal
  return s === 'y' || s === 'yes' || s === 'true' || s === '1'
}

function parseOptionalInt(v: unknown): number | null {
  const s = cellStr(v)
  if (!s) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

function parseOptionalFloat(v: unknown): number | null {
  const s = cellStr(v)
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function splitPipeUrls(v: unknown): string[] {
  const s = cellStr(v)
  if (!s) return []
  return s.split('|').map((u) => u.trim()).filter(Boolean)
}

function parseStoneLinesFromRow(row: RawRow): unknown[] {
  const jsonRaw = cellStr(row.stone_lines_json)
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as unknown
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* fall through */
    }
  }
  const lines: unknown[] = []
  for (let i = 1; i <= 3; i++) {
    const name = cellStr(row[`stone_${i}_name`])
    const cut_size = cellStr(row[`stone_${i}_cut_size`])
    const shape = cellStr(row[`stone_${i}_shape`])
    const color = cellStr(row[`stone_${i}_color`])
    const count = parseOptionalInt(row[`stone_${i}_count`])
    const rate_inr = parseOptionalFloat(row[`stone_${i}_rate_inr`])
    if (!name && !cut_size && rate_inr == null) continue
    lines.push({ name, cut_size, shape, color, count, rate_inr })
  }
  return lines
}

export type ParsedSpreadsheet = {
  rows: RawRow[]
  ignoredColumns: string[]
}

export function parseSpreadsheetBuffer(buffer: Buffer, filename: string): ParsedSpreadsheet {
  const ignoredAccumulator = new Set<string>()
  const isCsv = filename.toLowerCase().endsWith('.csv')
  try {
    const wb = readSpreadsheetWorkbook(buffer, filename)
    const sheetName = wb.SheetNames.includes('Products') ? 'Products' : wb.SheetNames[0]
    if (!sheetName) return { rows: [], ignoredColumns: [] }

    const sheet = wb.Sheets[sheetName]!
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })

    if (isCsv && rows.length === 0) {
      const text = buffer.toString('utf-8')
      const csvWb = XLSX.read(text, { type: 'string' })
      const csvSheet = csvWb.Sheets[csvWb.SheetNames[0]!]
      if (csvSheet) {
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(csvSheet, { defval: '' })
      }
    }

    const parsedRows = rows.map((row) => normalizeRow(row, ignoredAccumulator)).filter(isNonEmptyRow)
    return {
      rows: parsedRows,
      ignoredColumns: [...ignoredAccumulator].sort((a, b) => a.localeCompare(b)),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown parse error'
    throw new Error(`Could not read spreadsheet. ${msg}`)
  }
}

async function fetchProductsForLookups(supabase: SupabaseClient) {
  const withDesign = await supabase
    .from('products')
    .select('slug, design_number, category_id, product_number')

  if (!withDesign.error) return withDesign.data ?? []

  const withoutDesign = await supabase.from('products').select('slug, category_id, product_number')
  return (withoutDesign.data ?? []).map((p) => ({ ...p, design_number: null }))
}

async function loadMasterLookups(supabase: SupabaseClient): Promise<MasterLookups> {
  const [{ data: categoryRows }, { data: collections }, { data: colors }, { data: purities }, products] =
    await Promise.all([
      supabase.from('categories').select('id, code, name, display_order').eq('is_active', true).order('display_order'),
      supabase.from('collections').select('id, slug').eq('is_active', true),
      supabase.from('metal_colors').select('id, code').eq('is_active', true),
      supabase.from('metal_purities').select('id, code, metal').eq('is_active', true),
      fetchProductsForLookups(supabase),
    ])

  const sortedCategories = (categoryRows ?? [])
    .filter((c) => c.code)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))

  const rnDefault = sortedCategories.find((c) => String(c.code).toUpperCase() === 'RN')
  const defaultCat = rnDefault ?? sortedCategories[0]
  const defaultCategoryId = defaultCat?.id as string
  const defaultCategoryCode = defaultCat?.code ? String(defaultCat.code).toUpperCase() : 'RN'

  const nextProductNumberByCategory = new Map<string, number>()
  for (const p of products ?? []) {
    const cid = p.category_id as string | null
    const num = typeof p.product_number === 'number' ? p.product_number : 0
    if (cid) {
      const cur = nextProductNumberByCategory.get(cid) ?? 0
      if (num >= cur) nextProductNumberByCategory.set(cid, num + 1)
    }
  }

  return {
    categories: new Map(
      sortedCategories.map((c) => [String(c.code).toUpperCase(), c.id as string]),
    ),
    categoriesByName: new Map(
      sortedCategories.map((c) => [String(c.name).toUpperCase(), c.id as string]),
    ),
    defaultCategoryId,
    defaultCategoryCode,
    collections: new Map(
      (collections ?? []).map((c) => [String(c.slug).toLowerCase(), c.id as string]),
    ),
    colors: new Map(
      (colors ?? []).map((c) => [String(c.code).toUpperCase(), { id: c.id as string, code: String(c.code) }]),
    ),
    purities: new Map(
      (purities ?? []).map((p) => [
        String(p.code).toUpperCase(),
        { id: p.id as string, code: String(p.code), metal: String(p.metal ?? 'gold') },
      ]),
    ),
    existingSlugs: new Set((products ?? []).map((p) => String(p.slug).toLowerCase())),
    existingDesignNumbers: new Set(
      (products ?? [])
        .map((p) => (p.design_number ? String(p.design_number).trim().toUpperCase() : ''))
        .filter(Boolean),
    ),
    nextProductNumberByCategory,
  }
}

type GroupedProduct = {
  design_number: string
  rows: Array<{ rowNum: number; row: RawRow }>
}

function groupRowsByDesign(rows: RawRow[]): { groups: GroupedProduct[]; errors: BulkImportRowError[] } {
  const errors: BulkImportRowError[] = []
  const map = new Map<string, GroupedProduct>()

  rows.forEach((row, index) => {
    const rowNum = index + 2
    const design =
      cellStr(row.design_number).toUpperCase() ||
      cellStr(row.slug).toUpperCase()
    if (!design) {
      errors.push({ row: rowNum, design_number: '', message: 'design_number or slug is required' })
      return
    }
    const existing = map.get(design) ?? { design_number: design, rows: [] }
    existing.rows.push({ rowNum, row })
    map.set(design, existing)
  })

  return { groups: [...map.values()], errors }
}

function resolveName(group: GroupedProduct): string {
  for (const { row } of group.rows) {
    const n = cellStr(row.name)
    if (n) return n
  }
  return ''
}

function resolveBaseMetal(first: RawRow): 'gold' | 'silver' {
  const m = cellStr(first.base_metal).toLowerCase()
  return m === 'silver' ? 'silver' : 'gold'
}

function defaultColorForMetal(metal: 'gold' | 'silver'): string {
  return metal === 'silver' ? 'SV' : 'YG'
}

function defaultPurityForMetal(metal: 'gold' | 'silver'): string {
  return metal === 'silver' ? '925' : '18'
}

type RowVariantWeight = { purityCode: string; weight: number; fromNetColumn: boolean }

function extractVariantWeightsFromRow(
  row: RawRow,
  baseMetal: 'gold' | 'silver',
): RowVariantWeight[] {
  const single = parseOptionalFloat(row.metal_weight_g)
  if (single != null && single > 0) {
    const purity =
      cellStr(row.purity_code).toUpperCase() || defaultPurityForMetal(baseMetal)
    return [{ purityCode: purity, weight: single, fromNetColumn: false }]
  }

  const fromNetColumns: RowVariantWeight[] = []
  for (const [col, purityCode] of Object.entries(PURITY_NET_COLUMNS)) {
    const weight = parseOptionalFloat(row[col])
    if (weight != null && weight > 0) {
      fromNetColumns.push({ purityCode, weight, fromNetColumn: true })
    }
  }
  return fromNetColumns
}

function resolveCategoryId(
  rawCategory: string,
  lookups: MasterLookups,
): { categoryId: string | undefined; categoryCode: string } {
  const trimmed = rawCategory.trim()
  if (!trimmed) {
    return { categoryId: undefined, categoryCode: '' }
  }
  const upper = trimmed.toUpperCase()
  const byCode = lookups.categories.get(upper)
  if (byCode) return { categoryId: byCode, categoryCode: upper }
  const byName = lookups.categoriesByName.get(trimmed.toUpperCase())
  if (byName) {
    const code =
      [...lookups.categories.entries()].find(([, id]) => id === byName)?.[0] ??
      lookups.defaultCategoryCode
    return { categoryId: byName, categoryCode: code }
  }
  return { categoryId: undefined, categoryCode: upper }
}

function buildPayloadForGroup(
  group: GroupedProduct,
  lookups: MasterLookups,
  reservedSlugs: Set<string>,
): {
  payload: CatalogProductPayload | null
  errors: BulkImportRowError[]
  warnings: BulkImportWarning[]
  slug: string
} {
  const errors: BulkImportRowError[] = []
  const warnings: BulkImportWarning[] = []
  const first = group.rows[0]!.row
  const design = group.design_number
  const firstRowNum = group.rows[0]!.rowNum

  if (lookups.existingDesignNumbers.has(design)) {
    errors.push({ row: firstRowNum, design_number: design, message: 'design_number already exists in database' })
    return { payload: null, errors, warnings, slug: '' }
  }

  const name = resolveName(group)
  if (!name) {
    errors.push({ row: firstRowNum, design_number: design, message: 'name is required' })
    return { payload: null, errors, warnings, slug: '' }
  }

  const baseMetal = resolveBaseMetal(first)
  if (!cellStr(first.base_metal)) {
    warnings.push({
      row: firstRowNum,
      design_number: design,
      message: `base_metal missing — defaulted to ${baseMetal}`,
    })
  }

  let categoryCode = cellStr(first.category_code)
  let { categoryId, categoryCode: resolvedCode } = resolveCategoryId(categoryCode, lookups)
  if (resolvedCode) categoryCode = resolvedCode
  if (!categoryId) {
    if (categoryCode) {
      warnings.push({
        row: firstRowNum,
        design_number: design,
        message: `Unknown category "${cellStr(first.category_code)}" — defaulted to ${lookups.defaultCategoryCode}`,
      })
    } else {
      warnings.push({
        row: firstRowNum,
        design_number: design,
        message: `category_code missing — defaulted to ${lookups.defaultCategoryCode}`,
      })
    }
    categoryCode = lookups.defaultCategoryCode
    categoryId = lookups.defaultCategoryId
  }

  if (!categoryId) {
    errors.push({ row: firstRowNum, design_number: design, message: 'No active category in database — seed categories first' })
    return { payload: null, errors, warnings, slug: '' }
  }

  let slug = cellStr(first.slug) || slugifyName(name)
  if (!slug) slug = slugifyName(design)
  let candidate = slug
  let suffix = 2
  while (lookups.existingSlugs.has(candidate.toLowerCase()) || reservedSlugs.has(candidate.toLowerCase())) {
    candidate = `${slug}-${suffix}`
    suffix++
  }
  reservedSlugs.add(candidate.toLowerCase())
  slug = candidate

  const collectionSlug = cellStr(first.collection_slug).toLowerCase()
  let collectionId: string | null = null
  if (collectionSlug) {
    collectionId = lookups.collections.get(collectionSlug) ?? null
    if (!collectionId) {
      warnings.push({
        row: firstRowNum,
        design_number: design,
        message: `Unknown collection_slug "${collectionSlug}" — ignored`,
      })
    }
  }

  let productNumber = parseOptionalInt(first.product_number)
  if (productNumber == null || productNumber < 1) {
    const next = lookups.nextProductNumberByCategory.get(categoryId) ?? 1
    productNumber = next
    lookups.nextProductNumberByCategory.set(categoryId, next + 1)
  }

  const colorMedia = new Map<string, { images: string[]; videos: string[]; order: number }>()
  const matrix: MatrixCell[] = []
  const variantKeys = new Set<string>()
  let colorOrder = 0

  for (const { row, rowNum } of group.rows) {
    const variantWeights = extractVariantWeightsFromRow(row, baseMetal)
    if (variantWeights.length === 0) {
      errors.push({
        row: rowNum,
        design_number: design,
        message: 'Net weight required — add metal_weight_g or 14K Net / 18K Net / 22K Net column with a positive value',
      })
      continue
    }

    let rowColorCode = cellStr(row.color_code).toUpperCase() || defaultColorForMetal(baseMetal)
    if (!cellStr(row.color_code)) {
      warnings.push({
        row: rowNum,
        design_number: design,
        message: `color_code missing — defaulted to ${rowColorCode}`,
      })
    }
    if (baseMetal === 'silver' && rowColorCode !== 'SV') {
      rowColorCode = 'SV'
    }

    if (!colorMedia.has(rowColorCode)) {
      colorMedia.set(rowColorCode, {
        images: splitPipeUrls(row.color_images),
        videos: splitPipeUrls(row.color_videos),
        order: colorOrder++,
      })
    } else {
      const cm = colorMedia.get(rowColorCode)!
      for (const u of splitPipeUrls(row.color_images)) if (!cm.images.includes(u)) cm.images.push(u)
      for (const u of splitPipeUrls(row.color_videos)) if (!cm.videos.includes(u)) cm.videos.push(u)
    }

    const stockQty = parseOptionalInt(row.stock_qty)
    if (stockQty == null) {
      warnings.push({
        row: rowNum,
        design_number: design,
        message: 'stock_qty missing — defaulted to 0',
      })
    }
    const usesNetColumns = variantWeights.some((v) => v.fromNetColumn)
    if (usesNetColumns) {
      warnings.push({
        row: rowNum,
        design_number: design,
        message: 'Using 14K Net / 18K Net / 22K Net columns — one variant per purity column',
      })
    }

    for (const variant of variantWeights) {
      let purityCode = variant.purityCode
      if (!variant.fromNetColumn) {
        const rowPurity = cellStr(row.purity_code).toUpperCase()
        if (rowPurity) purityCode = rowPurity
        else {
          warnings.push({
            row: rowNum,
            design_number: design,
            message: `purity_code missing — defaulted to ${purityCode}`,
          })
        }
      }

      let colorMeta = lookups.colors.get(rowColorCode)
      if (!colorMeta) {
        const fallback = defaultColorForMetal(baseMetal)
        warnings.push({
          row: rowNum,
          design_number: design,
          message: `Unknown color_code — defaulted to ${fallback}`,
        })
        rowColorCode = fallback
        colorMeta = lookups.colors.get(rowColorCode)
      }

      let purityMeta = lookups.purities.get(purityCode)
      if (!purityMeta || purityMeta.metal.toLowerCase() !== baseMetal) {
        const fallback = defaultPurityForMetal(baseMetal)
        warnings.push({
          row: rowNum,
          design_number: design,
          message: `purity_code ${purityCode} invalid for ${baseMetal} — defaulted to ${fallback}`,
        })
        purityCode = fallback
        purityMeta = lookups.purities.get(purityCode)
      }

      if (!colorMeta || !purityMeta) {
        errors.push({ row: rowNum, design_number: design, message: 'Metal colour/purity masters missing in database' })
        continue
      }

      const variantKey = `${rowColorCode}:${purityCode}`
      if (variantKeys.has(variantKey)) {
        warnings.push({
          row: rowNum,
          design_number: design,
          message: `Duplicate variant ${rowColorCode} + ${purityCode} — skipped`,
        })
        continue
      }
      variantKeys.add(variantKey)

      matrix.push({
        color_id: colorMeta.id,
        purity_id: purityMeta.id,
        metal_weight_g: variant.weight,
        stock_qty: Math.max(0, stockQty ?? 0),
        is_active: parseYn(row.variant_active, true),
      })
    }
  }

  if (matrix.length === 0) {
    errors.push({
      row: firstRowNum,
      design_number: design,
      message: 'No valid variants — add metal_weight_g or 14K Net / 18K Net / 22K Net with positive weight',
    })
    return { payload: null, errors, warnings, slug: '' }
  }

  const color_variants: ColorVariantIn[] = [...colorMedia.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([code, media]) => ({
      color_id: lookups.colors.get(code)!.id,
      images: media.images,
      videos: media.videos,
      display_order: media.order,
      is_active: true,
    }))

  const hasMedia = color_variants.some(
    (cv) => cv.images.length > 0 || (cv.videos?.length ?? 0) > 0,
  )
  if (!hasMedia) {
    warnings.push({
      row: firstRowNum,
      design_number: design,
      message: 'Imported as draft — add images before publishing',
    })
  }

  const rawShortDesc = cellStr(first.short_desc)
  const shortDesc = rawShortDesc || BULK_SHORT_DESC_PLACEHOLDER
  if (!rawShortDesc) {
    warnings.push({
      row: firstRowNum,
      design_number: design,
      message: 'short_desc missing — placeholder added for CMS edit',
    })
  }

  const stoneLines = parseStoneLinesFromRow(first)
  const hasStone = parseYn(first.has_stone, false) && stoneLines.length > 0

  const payload: CatalogProductPayload = {
    product: {
      name,
      slug,
      category_id: categoryId,
      collection_id: collectionId,
      product_number: productNumber,
      design_number: design,
      short_desc: shortDesc,
      description: cellStr(first.description) || null,
      diamond_shape: cellStr(first.diamond_shape) || null,
      diamond_count: parseOptionalInt(first.diamond_count),
      total_diamond_wt: parseOptionalFloat(first.total_diamond_wt),
      diamond_color: cellStr(first.diamond_color) || null,
      diamond_clarity: cellStr(first.diamond_clarity) || null,
      size_range: cellStr(first.size_range) || null,
      meta_title: cellStr(first.meta_title) || null,
      meta_description: cellStr(first.meta_description) || null,
      status: 'draft',
      is_featured: parseYn(first.is_featured, false),
      is_new_arrival: parseYn(first.is_new_arrival, false),
      is_best_seller: parseYn(first.is_best_seller, false),
      is_coming_soon: parseYn(first.is_coming_soon, false),
      making_charge_pct: parseOptionalFloat(first.making_charge_pct) ?? 8,
      has_stone: hasStone,
      stone_lines: hasStone ? stoneLines : [],
    },
    color_variants,
    matrix,
  }

  return { payload, errors: [], warnings, slug }
}

const MAX_LIST_RETURNED = 250

export async function runBulkProductImport(
  supabase: SupabaseClient,
  buffer: Buffer,
  filename: string,
): Promise<BulkImportResult> {
  let rawRows: RawRow[]
  let ignoredColumns: string[] = []
  try {
    const parsed = parseSpreadsheetBuffer(buffer, filename)
    rawRows = parsed.rows
    ignoredColumns = parsed.ignoredColumns
  } catch (err: unknown) {
    return {
      imported: 0,
      failed: 1,
      errors: [{
        row: 1,
        design_number: '',
        message: err instanceof Error ? err.message : 'Failed to parse file',
      }],
      warnings: [],
      ignoredColumns: [],
      created: [],
    }
  }

  if (rawRows.length === 0) {
    return {
      imported: 0,
      failed: 1,
      errors: [{ row: 1, design_number: '', message: 'No data rows found in file' }],
      warnings: [],
      ignoredColumns,
      created: [],
    }
  }

  const { groups, errors: groupErrors } = groupRowsByDesign(rawRows)
  const lookups = await loadMasterLookups(supabase)
  const reservedSlugs = new Set<string>()
  const allErrors: BulkImportRowError[] = [...groupErrors]
  const allWarnings: BulkImportWarning[] = []
  const created: BulkImportResult['created'] = []
  let imported = 0
  let failed = 0

  for (const group of groups) {
    const { payload, errors, warnings, slug } = buildPayloadForGroup(group, lookups, reservedSlugs)
    allWarnings.push(...warnings)

    if (errors.length > 0) {
      allErrors.push(...errors)
      failed++
      continue
    }
    if (!payload) {
      failed++
      continue
    }

    const result = await createCatalogProduct(supabase, payload)
    if (result.ok === false) {
      allErrors.push({
        row: group.rows[0]!.rowNum,
        design_number: group.design_number,
        message: result.error,
      })
      failed++
      continue
    }

    imported++
    lookups.existingDesignNumbers.add(group.design_number)
    created.push({
      design_number: group.design_number,
      productId: result.productId,
      slug,
    })
  }

  if (groupErrors.length > 0 && failed === 0) {
    failed = 1
  }

  const truncate = <T>(list: T[]): T[] =>
    list.length > MAX_LIST_RETURNED
      ? [
          ...list.slice(0, MAX_LIST_RETURNED),
          {
            row: 0,
            design_number: '',
            message: `…and ${list.length - MAX_LIST_RETURNED} more not shown`,
          } as T,
        ]
      : list

  return {
    imported,
    failed,
    errors: truncate(allErrors),
    warnings: truncate(allWarnings),
    ignoredColumns,
    created,
  }
}

export { PRODUCTS_HEADERS }
