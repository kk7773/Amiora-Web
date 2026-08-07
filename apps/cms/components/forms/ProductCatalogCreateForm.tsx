'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronUp, ChevronDown, X, Film } from 'lucide-react'
import { formatINR, resolveLiveRate } from '@amiora/pricing'
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload'
import { generateAmioraSKU, slugifyName } from '@/lib/sku'
import { isBulkImportPlaceholder } from '@/lib/bulkImportConstants'
import { buildProductCode } from '@/lib/productIdentity'

type Category = { id: string; name: string; code: string | null }
type Collection = { id: string; name: string }
type TagOption = { id: string; name: string; color?: string | null }
type MetalColor = { id: string; label: string; code: string; hex: string | null; display_order: number }
type MetalPurity = {
  id: string
  label: string
  code: string
  display_order: number
  metal?: 'gold' | 'silver' | 'platinum' | string
}

type ChainLengthUi = {
  key: string
  length_inch: string
  weight_g: string
}

type SizeStockUi = {
  key: string
  color_id: string
  purity_id: string
  size_label: string
  size_type: 'ring_us' | 'chain_inch'
  stock_qty: string
  metal_weight_g: string
  price_override: string
  is_active: boolean
}

const CHAIN_LENGTH_OPTIONS = ['14', '16', '18', '20', '22'] as const
const RING_SIZE_OPTIONS = Array.from({ length: 23 }, (_, index) => String(index + 6))
const RING_SIZE_GROUP_BASE_INDEX = 2
const RING_SIZE_GROUP_STEP_PCT = 0.08
const DEFAULT_STOCK_QTY = '3'
const GOLD_WEIGHT_SYNC_STEPS = {
  '09->14': 1.11,
  '14->18': 1.15,
} as const

const DIAMOND_SHAPE_OPTIONS = [
  'Round',
  'Oval',
  'Princess',
  'Tear',
  'Emerald',
  'Pear',
  'Heart',
  'Marquis',
] as const

function normalizeDiamondShape(value: string) {
  const normalized = value.trim().toLowerCase()
  return DIAMOND_SHAPE_OPTIONS.find((shape) => shape.toLowerCase() === normalized) ?? value.trim()
}

function inferProductMetal(metalPuritiesList: MetalPurity[], initial?: InitialData): 'gold' | 'silver' {
  const pid = initial?.matrix?.[0]?.purity_id
  if (!pid) return 'gold'
  const row = metalPuritiesList.find((x) => x.id === pid)
  const m = (row?.metal ?? 'gold').toLowerCase()
  return m === 'silver' ? 'silver' : 'gold'
}

/** Silver catalog uses one internal colour row (Sterling / SV). */
function pickSilverColorId(colors: MetalColor[]): string {
  if (!colors.length) return ''
  const silver = colors.find(
    (c) =>
      /silver|925|sterling/i.test(c.label) ||
      c.code.toUpperCase() === 'SV' ||
      c.code.toUpperCase() === 'AG',
  )
  if (silver) return silver.id
  return colors[0]!.id
}

type ColorRow = {
  key: string
  id?: string
  color_id: string
  images: string[]
  videos: string[]
  display_order: number
}

type MatrixSeedCell = {
  id?: string
  color_id: string
  purity_id: string
  price: number
  stock_qty: number
  is_active: boolean
  metal_weight_g?: number | null
  sku?: string
}

type InitialData = {
  id: string
  product: {
    name: string
    slug: string
    category_id: string
    collection_id: string | null
    collection_ids?: string[]
    tag_ids?: string[]
    product_number?: number
    design_number: string | null
    product_code?: string | null
    short_desc: string | null
    description: string | null
    diamond_shape: string | null
    diamond_count: number | null
    total_diamond_wt: number | null
    diamond_color: string | null
    diamond_clarity: string | null
    size_range: string | null
    chain_lengths?: unknown
    size_stocks?: unknown
    metal_weight_g?: number | null
    meta_title: string | null
    meta_description: string | null
    status: 'draft' | 'active' | 'archived' | 'make_to_order'
    is_featured: boolean
    is_new_arrival: boolean
    is_best_seller: boolean
    is_coming_soon: boolean
    making_charge_pct: number
    has_stone?: boolean
    stone_lines?: unknown
  }
  colorVariants: Array<{
    id: string
    color_id: string
    images: string[]
    videos?: string[]
    display_order: number
  }>
  matrix: MatrixSeedCell[]
}

export type ProductCatalogCreateFormProps = {
  categories: Category[]
  collections: Collection[]
  tags?: TagOption[]
  metalColors: MetalColor[]
  metalPurities: MetalPurity[]
  initialData?: InitialData
  defaultMakingChargePct?: number
  pricingContext: {
    currentGoldPerGram: number
    currentSilverPerGram: number
    currentDiamondPerCarat: number
    goldPurityRates: {
      '09': number | null
      '14': number | null
      '18': number | null
      '22': number | null
    }
  }
}

type CellState = {
  id?: string
  gross_weight_g: string
  stock_qty: string
  is_active: boolean
  seed_price?: number
}

function buildCellKey(colorId: string, purityId: string) {
  return `${colorId}:${purityId}`
}

function normalizeGoldPurityCode(code: string | null | undefined): '09' | '14' | '18' | '22' | null {
  if (!code) return null
  const digits = code.replace(/\D/g, '')
  if (digits === '9' || digits === '09') return '09'
  if (digits === '14') return '14'
  if (digits === '18') return '18'
  if (digits === '22') return '22'
  return null
}

function roundWeight(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3)
}

function deriveRelatedGoldWeights(sourceCode: '09' | '14' | '18' | '22', rawWeight: string) {
  const trimmed = rawWeight.trim()
  if (trimmed === '') {
    return new Map<'09' | '14' | '18' | '22', string>([[sourceCode, '']])
  }

  const input = parseFloat(trimmed)
  if (!Number.isFinite(input) || input <= 0) {
    return new Map<'09' | '14' | '18' | '22', string>([[sourceCode, rawWeight]])
  }

  const weights = new Map<'09' | '14' | '18' | '22', string>()

  if (sourceCode === '22') {
    weights.set('22', rawWeight)
    return weights
  }

  let weight09: number
  if (sourceCode === '09') {
    weight09 = input
  } else if (sourceCode === '14') {
    weight09 = input / GOLD_WEIGHT_SYNC_STEPS['09->14']
  } else {
    weight09 = input / GOLD_WEIGHT_SYNC_STEPS['14->18'] / GOLD_WEIGHT_SYNC_STEPS['09->14']
  }

  const weight14 = weight09 * GOLD_WEIGHT_SYNC_STEPS['09->14']
  const weight18 = weight14 * GOLD_WEIGHT_SYNC_STEPS['14->18']

  weights.set('09', sourceCode === '09' ? rawWeight : roundWeight(weight09))
  weights.set('14', sourceCode === '14' ? rawWeight : roundWeight(weight14))
  weights.set('18', sourceCode === '18' ? rawWeight : roundWeight(weight18))
  return weights
}

type VariantColorMediaProps = {
  rowKey: string
  images: string[]
  videos: string[]
  uploading: boolean
  onPickImages: (rowKey: string, files: FileList | null) => void
  onPickVideos: (rowKey: string, files: FileList | null) => void
  onRemoveImage: (rowKey: string, index: number) => void
  onRemoveVideo: (rowKey: string, index: number) => void
  onReorderImage: (rowKey: string, index: number, dir: -1 | 1) => void
}

function VariantColorMedia({
  rowKey,
  images,
  videos,
  uploading,
  onPickImages,
  onPickVideos,
  onRemoveImage,
  onRemoveVideo,
  onReorderImage,
}: VariantColorMediaProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-ink-muted block mb-1.5">Images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            onPickImages(rowKey, e.target.files)
            e.target.value = ''
          }}
          disabled={uploading}
          className="text-sm"
        />
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {images.map((url, imageIndex) => (
              <div key={`${url}-${imageIndex}`} className="relative w-20 h-20 rounded border overflow-hidden group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(rowKey, imageIndex)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0.5 left-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <button type="button" className="bg-white/90 text-xs px-1 rounded" onClick={() => onReorderImage(rowKey, imageIndex, -1)}>↑</button>
                  <button type="button" className="bg-white/90 text-xs px-1 rounded" onClick={() => onReorderImage(rowKey, imageIndex, 1)}>↓</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-ink-muted block mb-1.5">Videos</label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          multiple
          onChange={(e) => {
            onPickVideos(rowKey, e.target.files)
            e.target.value = ''
          }}
          disabled={uploading}
          className="text-sm"
        />
        {videos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {videos.map((url, videoIndex) => (
              <div key={`${url}-${videoIndex}`} className="relative w-28 h-20 rounded border overflow-hidden bg-ink/5">
                <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                  <Film className="w-2.5 h-2.5" /> Video
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveVideo(rowKey, videoIndex)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700"
                  aria-label="Remove video"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function buildCellState(
  matrix: MatrixSeedCell[],
) {
  return Object.fromEntries(
    matrix.map((cell) => [
      buildCellKey(cell.color_id, cell.purity_id),
      {
        id: cell.id,
        gross_weight_g: cell.metal_weight_g != null && Number.isFinite(Number(cell.metal_weight_g))
          ? String(Math.round(Number(cell.metal_weight_g) * 1000) / 1000)
          : '',
        stock_qty: String(cell.stock_qty),
        is_active: cell.is_active,
        seed_price:
          typeof cell.price === 'number' && Number.isFinite(cell.price) && cell.price > 0
            ? cell.price
            : undefined,
      } satisfies CellState,
    ]),
  ) as Record<string, CellState>
}

type StoneSizeUi = {
  key: string
  cut_size: string
  count: string
  weight: string
  price_per_carat: string
  rate: string
}

type StoneTypeUi = 'diamond' | 'other_than_diamond' | ''

type StoneLineUi = {
  key: string
  stone_type: StoneTypeUi
  shape: string
  color: string
  sizes: StoneSizeUi[]
}

function normalizeStoneType(value: unknown): StoneTypeUi {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  if (normalized === 'diamond') return 'diamond'
  if (
    normalized === 'other_than_diamond' ||
    normalized === 'other than diamond' ||
    normalized === 'other-than-diamond'
  ) {
    return 'other_than_diamond'
  }
  return ''
}

function stoneTypeLabel(value: StoneTypeUi): string {
  if (value === 'diamond') return 'Diamond'
  if (value === 'other_than_diamond') return 'Other than diamond'
  return 'Stine'
}

function stoneSizeFromDb(raw: unknown, keyPrefix: string): StoneSizeUi[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((item, index) => {
    const o = item as Record<string, unknown>
    const cutSize = typeof o.cut_size === 'string' ? o.cut_size : ''
    const rateRaw = o.rate_inr
    const countRaw = o.count
    const weightRaw = o.weight
    const pricePerCaratRaw = o.price_per_carat_inr
    const rate =
      typeof rateRaw === 'number' && Number.isFinite(rateRaw)
        ? String(rateRaw)
        : typeof rateRaw === 'string' && rateRaw.trim() !== ''
          ? rateRaw
          : ''
    const price_per_carat =
      typeof pricePerCaratRaw === 'number' && Number.isFinite(pricePerCaratRaw)
        ? String(pricePerCaratRaw)
        : typeof pricePerCaratRaw === 'string' && pricePerCaratRaw.trim() !== ''
          ? pricePerCaratRaw
          : rate
    const count =
      typeof countRaw === 'number' && Number.isFinite(countRaw)
        ? String(countRaw)
        : typeof countRaw === 'string' && countRaw.trim() !== ''
          ? countRaw
          : ''
    const weight =
      typeof weightRaw === 'number' && Number.isFinite(weightRaw)
        ? String(weightRaw)
        : typeof weightRaw === 'string' && weightRaw.trim() !== ''
          ? weightRaw
          : ''
    return {
      key: `${keyPrefix}-size-${index}`,
      cut_size: cutSize,
      count,
      weight,
      price_per_carat,
      rate,
    }
  })
}

function stoneLinesFromDb(raw: unknown): StoneLineUi[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((item, i) => {
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : ''
    const stone_type = normalizeStoneType(o.stone_type ?? name)
    const shape = typeof o.shape === 'string' ? normalizeDiamondShape(o.shape) : ''
    const color = typeof o.color === 'string' ? o.color : ''
    const sizes = stoneSizeFromDb(
      Array.isArray(o.sizes)
      ? o.sizes
        : [{
            cut_size: o.cut_size ?? '',
            count: o.count ?? '',
            weight: o.weight ?? '',
            price_per_carat_inr: o.price_per_carat_inr ?? '',
            rate_inr: o.rate_inr ?? '',
            price_inr: o.price_inr ?? '',
          }],
      `st-${i}`,
    )
    return {
      key: `st-${i}-${name.slice(0, 8)}`,
      stone_type,
      shape,
      color,
      sizes: sizes.length > 0
        ? sizes
        : [{ key: `st-${i}-size-0`, cut_size: '', count: '', weight: '', price_per_carat: '', rate: '' }],
    }
  })
}

function newStoneRow(): StoneLineUi {
  return {
    key: `st-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    stone_type: '',
    shape: '',
    color: '',
    sizes: [newStoneSizeRow()],
  }
}

function newStoneSizeRow(): StoneSizeUi {
  return {
    key: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    cut_size: '',
    count: '',
    weight: '',
    price_per_carat: '',
    rate: '',
  }
}

function newChainLengthRow(lengthInch = ''): ChainLengthUi {
  return {
    key: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    length_inch: lengthInch,
    weight_g: '',
  }
}

function chainLengthsFromDb(raw: unknown): ChainLengthUi[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const lengthInch =
        typeof record.length_inch === 'number' && Number.isFinite(record.length_inch)
          ? String(record.length_inch)
          : typeof record.length_inch === 'string' && record.length_inch.trim() !== ''
            ? record.length_inch.trim()
            : typeof record.lengthInch === 'number' && Number.isFinite(record.lengthInch)
              ? String(record.lengthInch)
              : typeof record.lengthInch === 'string' && record.lengthInch.trim() !== ''
                ? record.lengthInch.trim()
                : ''
      const weightG =
        typeof record.weight_g === 'number' && Number.isFinite(record.weight_g)
          ? String(record.weight_g)
          : typeof record.weight_g === 'string' && record.weight_g.trim() !== ''
            ? record.weight_g.trim()
            : typeof record.weightG === 'number' && Number.isFinite(record.weightG)
              ? String(record.weightG)
              : typeof record.weightG === 'string' && record.weightG.trim() !== ''
                ? record.weightG.trim()
                : ''
      if (!lengthInch && !weightG) return null
      return {
        key: `cl-${index}-${lengthInch || 'row'}`,
        length_inch: lengthInch,
        weight_g: weightG,
      }
    })
    .filter((row): row is ChainLengthUi => row != null)
}

function buildSizeStockKey(colorId: string, purityId: string, sizeLabel: string) {
  return `${colorId}:${purityId}:${sizeLabel}`
}

function getRingSizeGroupIndex(sizeLabel: string): number | null {
  const size = Number(sizeLabel)
  if (!Number.isInteger(size) || size < 6 || size > 28) return null
  return Math.floor((size - 6) / 3)
}

function getRingSizeGroupMultiplier(groupIndex: number): number {
  return 1 + (groupIndex - RING_SIZE_GROUP_BASE_INDEX) * RING_SIZE_GROUP_STEP_PCT
}

function formatRingWeight(weight: number): string {
  return (Math.round(weight * 1000) / 1000).toFixed(3)
}

function buildRingGroupWeightMap(sourceSizeLabel: string, weightText: string): Map<string, string> {
  const trimmedWeight = weightText.trim()
  const result = new Map<string, string>()

  if (trimmedWeight === '') {
    for (const sizeLabel of RING_SIZE_OPTIONS) {
      result.set(sizeLabel, '')
    }
    return result
  }

  const enteredWeight = parseFloat(trimmedWeight)
  const sourceGroupIndex = getRingSizeGroupIndex(sourceSizeLabel)
  if (!Number.isFinite(enteredWeight) || enteredWeight <= 0 || sourceGroupIndex == null) {
    for (const sizeLabel of RING_SIZE_OPTIONS) {
      result.set(sizeLabel, '')
    }
    return result
  }

  const sourceMultiplier = getRingSizeGroupMultiplier(sourceGroupIndex)
  const baseGroupWeight = enteredWeight / sourceMultiplier

  for (const sizeLabel of RING_SIZE_OPTIONS) {
    const groupIndex = getRingSizeGroupIndex(sizeLabel)
    if (groupIndex == null) {
      result.set(sizeLabel, '')
      continue
    }
    result.set(sizeLabel, formatRingWeight(baseGroupWeight * getRingSizeGroupMultiplier(groupIndex)))
  }

  return result
}

function hasRingWeightValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(parseFloat(value))
}

function newSizeStockRow(params: {
  color_id: string
  purity_id: string
  size_label: string
  size_type: 'ring_us' | 'chain_inch'
  metal_weight_g?: string
  price_override?: string
}): SizeStockUi {
  return {
    key: `sz-${params.color_id}-${params.purity_id}-${params.size_label}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    color_id: params.color_id,
    purity_id: params.purity_id,
    size_label: params.size_label,
    size_type: params.size_type,
    stock_qty: DEFAULT_STOCK_QTY,
    metal_weight_g: params.metal_weight_g ?? '',
    price_override: params.price_override ?? '',
    is_active: true,
  }
}

function sizeStocksFromDb(raw: unknown): SizeStockUi[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const colorId = typeof record.color_id === 'string' ? record.color_id : ''
      const purityId = typeof record.purity_id === 'string' ? record.purity_id : ''
      const sizeLabel = typeof record.size_label === 'string' ? record.size_label.trim() : ''
      const sizeType = record.size_type === 'chain_inch' ? 'chain_inch' : 'ring_us'
      if (!colorId || !purityId || !sizeLabel) return null
      const stockQty =
        typeof record.stock_qty === 'number' && Number.isFinite(record.stock_qty)
          ? String(record.stock_qty)
          : typeof record.stock_qty === 'string' && record.stock_qty.trim() !== ''
            ? record.stock_qty.trim()
            : DEFAULT_STOCK_QTY
      const metalWeight =
        typeof record.metal_weight_g === 'number' && Number.isFinite(record.metal_weight_g)
          ? String(record.metal_weight_g)
          : typeof record.metal_weight_g === 'string' && record.metal_weight_g.trim() !== ''
            ? record.metal_weight_g.trim()
            : ''
      const priceOverride =
        typeof record.price_override === 'number' && Number.isFinite(record.price_override)
          ? String(record.price_override)
          : typeof record.price_override === 'string' && record.price_override.trim() !== ''
            ? record.price_override.trim()
            : ''
      return {
        key: `sz-${index}-${colorId}-${purityId}-${sizeLabel}`,
        color_id: colorId,
        purity_id: purityId,
        size_label: sizeLabel,
        size_type: sizeType,
        stock_qty: stockQty,
        metal_weight_g: metalWeight,
        price_override: priceOverride,
        is_active: record.is_active !== false,
      } satisfies SizeStockUi
    })
    .filter((row): row is SizeStockUi => row != null)
}

export function ProductCatalogCreateForm({
  categories,
  collections,
  tags = [],
  metalColors,
  metalPurities,
  initialData,
  defaultMakingChargePct = 8,
  pricingContext,
}: ProductCatalogCreateFormProps) {
  const router = useRouter()
  const { uploading, uploadFiles } = useCloudinaryUpload('amiora/products/colors')

  const isEdit = !!initialData

  const normalizedPurities = useMemo(
    () =>
      metalPurities.map((p) => ({
        ...p,
        metal: (p.metal ?? 'gold').toLowerCase() as 'gold' | 'silver' | 'platinum',
      })),
    [metalPurities],
  )

  const [productMetalType, setProductMetalType] = useState<'gold' | 'silver'>(() =>
    inferProductMetal(metalPurities, initialData),
  )

  const puritiesForProduct = useMemo(
    () =>
      normalizedPurities
        .filter((p) => p.metal === productMetalType)
        .sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)),
    [normalizedPurities, productMetalType],
  )
  const hasMetalColors = metalColors.length > 0
  const hasMetalPurities = metalPurities.length > 0
  const isGoldProduct = productMetalType === 'gold'
  const appliedLayoutMetalRef = useRef<'gold' | 'silver' | null>(null)

  const [name, setName] = useState(initialData?.product.name ?? '')
  const [slug, setSlug] = useState(initialData?.product.slug ?? '')
  const [slugManual, setSlugManual] = useState(!!initialData?.product.slug)
  const [categoryId, setCategoryId] = useState(initialData?.product.category_id ?? categories[0]?.id ?? '')
  const initCollectionIds = initialData?.product.collection_ids?.length
    ? initialData.product.collection_ids
    : initialData?.product.collection_id
      ? [initialData.product.collection_id]
      : []
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(initCollectionIds)
  const [primaryCollectionId, setPrimaryCollectionId] = useState<string>(
    initialData?.product.collection_id ?? initCollectionIds[0] ?? '',
  )
  const [tagIds, setTagIds] = useState<string[]>(initialData?.product.tag_ids ?? [])
  const [productNumber, setProductNumber] = useState(initialData?.product.product_number ?? 1)
  const [designNumber, setDesignNumber] = useState(initialData?.product.design_number ?? '')

  const [shortDesc, setShortDesc] = useState(initialData?.product.short_desc ?? '')
  const [description, setDescription] = useState(initialData?.product.description ?? '')

  const [diamondShape, setDiamondShape] = useState(initialData?.product.diamond_shape ?? '')
  const [diamondCount, setDiamondCount] = useState<string>(
    initialData?.product.diamond_count != null ? String(initialData.product.diamond_count) : '',
  )
  const [totalWt, setTotalWt] = useState<string>(
    initialData?.product.total_diamond_wt != null ? String(initialData.product.total_diamond_wt) : '',
  )
  const [diamondColor, setDiamondColor] = useState(initialData?.product.diamond_color ?? '')
  const [diamondClarity, setDiamondClarity] = useState(initialData?.product.diamond_clarity ?? '')
  const [sizeRange, setSizeRange] = useState(initialData?.product.size_range ?? '')
  const [chainLengths, setChainLengths] = useState<ChainLengthUi[]>(
    () => chainLengthsFromDb(initialData?.product.chain_lengths),
  )
  const [sizeStocks, setSizeStocks] = useState<SizeStockUi[]>(() =>
    sizeStocksFromDb(initialData?.product.size_stocks),
  )

  const [metaTitle, setMetaTitle] = useState(initialData?.product.meta_title ?? '')
  const [metaDesc, setMetaDesc] = useState(initialData?.product.meta_description ?? '')
  const [featured, setFeatured] = useState(initialData?.product.is_featured ?? false)
  const [newArrival, setNewArrival] = useState(initialData?.product.is_new_arrival ?? false)
  const [bestSeller, setBestSeller] = useState(initialData?.product.is_best_seller ?? false)
  const [comingSoon, setComingSoon] = useState(initialData?.product.is_coming_soon ?? false)
  const [status, setStatus] = useState<'draft' | 'active' | 'archived' | 'make_to_order'>(initialData?.product.status ?? 'draft')
  const [makingChargePct, setMakingChargePct] = useState<string>(
    String(initialData?.product.making_charge_pct ?? defaultMakingChargePct),
  )

  const [hasStone, setHasStone] = useState(() => Boolean(initialData?.product.has_stone))
  const [stoneRows, setStoneRows] = useState<StoneLineUi[]>(() => {
    const rows = stoneLinesFromDb(initialData?.product.stone_lines)
    return rows.length > 0 ? rows : []
  })
  const selectedCategory = categories.find((category) => category.id === categoryId)
  const selectedCategoryText = `${selectedCategory?.name ?? ''} ${selectedCategory?.code ?? ''}`
  const normalizedCategoryText = selectedCategoryText.toLowerCase()
  const isRingProduct = /\bring\b/.test(normalizedCategoryText)
  // Chain-length options apply to necklaces and pendants, but not unrelated categories.
  const isChainProduct = /\b(necklace|pendant|pendent)\b/.test(normalizedCategoryText)

  useEffect(() => {
    if (!hasStone) return
    setStoneRows((prev) => (prev.length === 0 ? [newStoneRow()] : prev))
  }, [hasStone])

  useEffect(() => {
    if (!isChainProduct) return
    setChainLengths((prev) => (prev.length > 0 ? prev : CHAIN_LENGTH_OPTIONS.map((length) => newChainLengthRow(length))))
  }, [isChainProduct])

  function updateChainLength(rowKey: string, updater: (row: ChainLengthUi) => ChainLengthUi) {
    setChainLengths((prev) => prev.map((row) => (row.key === rowKey ? updater(row) : row)))
  }

  function updateSizeStock(colorId: string, purityId: string, sizeLabel: string, updater: (row: SizeStockUi) => SizeStockUi) {
    setSizeStocks((prev) => {
      const index = prev.findIndex(
        (row) => row.color_id === colorId && row.purity_id === purityId && row.size_label === sizeLabel,
      )
      const current =
        index >= 0
          ? prev[index]!
          : newSizeStockRow({
              color_id: colorId,
              purity_id: purityId,
              size_label: sizeLabel,
              size_type: isChainProduct ? 'chain_inch' : 'ring_us',
            })
      const nextRow = updater(current)
      if (index >= 0) {
        const next = [...prev]
        next[index] = nextRow
        return next
      }
      return [...prev, nextRow]
    })
  }

  function syncRingWeightForVariant(colorId: string, purityId: string, sourceSizeLabel: string, weight: string) {
    const groupedWeights = buildRingGroupWeightMap(sourceSizeLabel, weight)
    setSizeStocks((prev) => {
      const next = [...prev]
      for (const ringSizeLabel of RING_SIZE_OPTIONS) {
        const index = next.findIndex(
          (row) =>
            row.color_id === colorId &&
            row.purity_id === purityId &&
            row.size_type === 'ring_us' &&
            row.size_label === ringSizeLabel,
        )
        const nextWeight = groupedWeights.get(ringSizeLabel) ?? ''
        if (index >= 0) {
          next[index] = { ...next[index]!, metal_weight_g: nextWeight }
          continue
        }
        next.push(
          newSizeStockRow({
            color_id: colorId,
            purity_id: purityId,
            size_label: ringSizeLabel,
            size_type: 'ring_us',
            metal_weight_g: nextWeight,
          }),
        )
      }
      return next
    })
  }

  function syncRingWeightAcrossPurities(colorId: string, sizeLabel: string, weight: string) {
    for (const purity of puritiesForProduct) {
      syncRingWeightForVariant(colorId, purity.id, sizeLabel, weight)
    }
  }

  function syncChainLengthWeight(sizeLabel: string, weight: string) {
    setChainLengths((prev) =>
      prev.map((row) =>
        row.length_inch === sizeLabel
          ? {
              ...row,
              weight_g: weight,
            }
          : row,
      ),
    )

    setSizeStocks((prev) => {
      const next = [...prev]
      for (const row of colorRows) {
        for (const purity of puritiesForProduct) {
          const index = next.findIndex(
            (entry) =>
              entry.color_id === row.color_id &&
              entry.purity_id === purity.id &&
              entry.size_type === 'chain_inch' &&
              entry.size_label === sizeLabel,
          )
          if (index >= 0) {
            next[index] = {
              ...next[index]!,
              metal_weight_g: weight,
            }
            continue
          }
          next.push(
            newSizeStockRow({
              color_id: row.color_id,
              purity_id: purity.id,
              size_label: sizeLabel,
              size_type: 'chain_inch',
              metal_weight_g: weight,
            }),
          )
        }
      }
      return next
    })
  }

  const [colorRows, setColorRows] = useState<ColorRow[]>(
    initialData?.colorVariants.map((row) => ({
      key: row.id,
      id: row.id,
      color_id: row.color_id,
      images: row.images,
      videos: row.videos ?? [],
      display_order: row.display_order,
    })) ?? [],
  )

  useEffect(() => {
    if (!(isRingProduct || isChainProduct)) return
    const sizeLabels = isRingProduct ? RING_SIZE_OPTIONS : CHAIN_LENGTH_OPTIONS
    setSizeStocks((prev) => {
      const next = [...prev]
      for (const row of colorRows) {
        for (const purity of puritiesForProduct) {
          for (const sizeLabel of sizeLabels) {
            const exists = next.some(
              (entry) =>
                entry.color_id === row.color_id &&
                entry.purity_id === purity.id &&
                entry.size_label === sizeLabel,
            )
            if (!exists) {
              next.push(
                newSizeStockRow({
                  color_id: row.color_id,
                  purity_id: purity.id,
                  size_label: sizeLabel,
                  size_type: isChainProduct ? 'chain_inch' : 'ring_us',
                }),
              )
            }
          }
        }
      }
      return next
    })
  }, [colorRows, puritiesForProduct, isRingProduct, isChainProduct])

  const [cells, setCells] = useState<Record<string, CellState>>(
    buildCellState(initialData?.matrix ?? []),
  )
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [justPublished, setJustPublished] = useState(false)

  useEffect(() => {
    if (status !== 'active' && justPublished) {
      setJustPublished(false)
    }
  }, [status, justPublished])

  const categoryCode = categories.find((c) => c.id === categoryId)?.code ?? 'XX'
  const productId = useMemo(() => {
    if (!categoryCode || !designNumber.trim()) return ''
    return buildProductCode(categoryCode, designNumber.trim())
  }, [categoryCode, designNumber])

  function toggleCollection(colId: string) {
    setSelectedCollectionIds((prev) => {
      const next = prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
      if (!next.includes(primaryCollectionId)) {
        setPrimaryCollectionId(next[0] ?? '')
      }
      return next
    })
  }

  function toggleTag(tagId: string) {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  const fetchNextNumber = useCallback(async (cat: string) => {
    if (!cat || isEdit) return
    const res = await fetch(`/api/products/next-number?category_id=${encodeURIComponent(cat)}`)
    if (!res.ok) return
    const j = (await res.json()) as { product_number?: number }
    if (typeof j.product_number === 'number') setProductNumber(j.product_number)
  }, [isEdit])

  useEffect(() => {
    if (categoryId) void fetchNextNumber(categoryId)
  }, [categoryId, fetchNextNumber])

  useEffect(() => {
    if (!slugManual && name) setSlug(slugifyName(name))
  }, [name, slugManual])

  /** New products only: reshape colour rows + matrix when switching gold ↔ silver */
  useEffect(() => {
    if (isEdit || metalColors.length === 0) return
    if (appliedLayoutMetalRef.current === productMetalType) return

    const fromLayout = appliedLayoutMetalRef.current

    if (productMetalType === 'silver') {
      const silverId = pickSilverColorId(metalColors)
      setColorRows((prev) => {
        const imgs = prev[0]?.images ?? []
        const vids = prev[0]?.videos ?? []
        return [
          {
            key: prev[0]?.key ?? `silver-${silverId}`,
            id: prev[0]?.id,
            color_id: silverId,
            images: imgs,
            videos: vids,
            display_order: 0,
          },
        ]
      })
      setCells({})
    } else {
      setColorRows((prev) => {
        if (fromLayout === 'silver') {
          return metalColors.slice(0, 3).map((color, index) => ({
            key: `seed-${color.id}-${index}`,
            color_id: color.id,
            images: index === 0 ? prev[0]?.images ?? [] : [],
            videos: index === 0 ? prev[0]?.videos ?? [] : [],
            display_order: index,
          }))
        }
        if (prev.length === 0) {
          return metalColors.slice(0, 3).map((color, index) => ({
            key: `seed-${color.id}`,
            color_id: color.id,
            images: [],
            videos: [],
            display_order: index,
          }))
        }
        return prev
      })
      if (fromLayout === 'silver') setCells({})
    }

    appliedLayoutMetalRef.current = productMetalType
  }, [productMetalType, metalColors, isEdit])

  function addColorRow() {
    if (!hasMetalColors) {
      toast.error('Metal colours missing. Seed `metal_colors` in Supabase first.')
      return
    }
    const available = metalColors.find((color) => !colorRows.some((row) => row.color_id === color.id)) ?? metalColors[0]
    if (!available) {
      toast.error('No metal colours in database')
      return
    }
    setColorRows((prev) => [
      ...prev,
      {
        key: `k-${Date.now()}`,
        color_id: available.id,
        images: [],
        videos: [],
        display_order: prev.length,
      },
    ])
  }

  function removeColorRow(key: string) {
    const row = colorRows.find((entry) => entry.key === key)
    setColorRows((prev) =>
      prev.filter((entry) => entry.key !== key).map((entry, index) => ({ ...entry, display_order: index })),
    )
    if (!row) return
    setCells((prev) => {
      const next = { ...prev }
      for (const purity of metalPurities) {
        delete next[buildCellKey(row.color_id, purity.id)]
      }
      return next
    })
  }

  function moveColorRow(key: string, dir: -1 | 1) {
    setColorRows((prev) => {
      const index = prev.findIndex((row) => row.key === key)
      if (index < 0) return prev
      const nextIndex = index + dir
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!]
      return next.map((row, idx) => ({ ...row, display_order: idx }))
    })
  }

  async function onPickFiles(rowKey: string, files: FileList | null) {
    if (!files?.length) return
    const list = await uploadFiles(Array.from(files), { resourceType: 'image' })
    if (!list.length) return
    setColorRows((prev) =>
      prev.map((row) =>
        row.key === rowKey ? { ...row, images: [...row.images, ...list.map((item) => item.url)] } : row,
      ),
    )
  }

  async function onPickVideos(rowKey: string, files: FileList | null) {
    if (!files?.length) return
    const list = await uploadFiles(Array.from(files), {
      resourceType: 'video',
      folder: 'amiora/products/videos',
    })
    if (!list.length) return
    setColorRows((prev) =>
      prev.map((row) =>
        row.key === rowKey ? { ...row, videos: [...row.videos, ...list.map((item) => item.url)] } : row,
      ),
    )
  }

  function removeImage(rowKey: string, imageIndex: number) {
    setColorRows((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? { ...row, images: row.images.filter((_, idx) => idx !== imageIndex) }
          : row,
      ),
    )
  }

  function removeVideo(rowKey: string, videoIndex: number) {
    setColorRows((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? { ...row, videos: row.videos.filter((_, idx) => idx !== videoIndex) }
          : row,
      ),
    )
  }

  function reorderImage(rowKey: string, imageIndex: number, dir: -1 | 1) {
    setColorRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row
        const imgs = [...row.images]
        const nextIndex = imageIndex + dir
        if (nextIndex < 0 || nextIndex >= imgs.length) return row
        ;[imgs[imageIndex], imgs[nextIndex]] = [imgs[nextIndex]!, imgs[imageIndex]!]
        return { ...row, images: imgs }
      }),
    )
  }

  function skuPreview(colorCode: string, purityCode: string) {
    return generateAmioraSKU(categoryCode, productNumber, purityCode, colorCode)
  }

  function setCellValue(colorId: string, purityId: string, updater: (current: CellState) => CellState) {
    const key = buildCellKey(colorId, purityId)
    setCells((prev) => {
      const current = prev[key] ?? { gross_weight_g: '', stock_qty: DEFAULT_STOCK_QTY, is_active: false }
      return { ...prev, [key]: updater(current) }
    })
  }

  function syncMatrixWeightAcrossAllCells(weight: string) {
    setCells((prev) => {
      const next: Record<string, CellState> = { ...prev }
      for (const row of colorRows) {
        for (const purity of puritiesForProduct) {
          const key = buildCellKey(row.color_id, purity.id)
          const current = next[key] ?? { gross_weight_g: '', stock_qty: DEFAULT_STOCK_QTY, is_active: false }
          next[key] = {
            ...current,
            gross_weight_g: weight,
          }
        }
      }
      return next
    })
  }

  function syncGoldMatrixWeightByPurity(sourcePurityId: string, weight: string) {
    setCells((prev) => {
      const sourcePurity = puritiesForProduct.find((entry) => entry.id === sourcePurityId)
      const normalizedCode = normalizeGoldPurityCode(sourcePurity?.code)
      if (!sourcePurity || !normalizedCode) return prev

      const relatedWeights = deriveRelatedGoldWeights(normalizedCode, weight)
      const next: Record<string, CellState> = { ...prev }

      for (const row of colorRows) {
        for (const purity of puritiesForProduct) {
          const purityCode = normalizeGoldPurityCode(purity.code)
          if (!purityCode) continue
          if (!relatedWeights.has(purityCode)) continue

          const key = buildCellKey(row.color_id, purity.id)
          const current = next[key] ?? { gross_weight_g: '', stock_qty: DEFAULT_STOCK_QTY, is_active: false }
          next[key] = {
            ...current,
            gross_weight_g: relatedWeights.get(purityCode) ?? '',
          }
        }
      }

      return next
    })
  }

  useEffect(() => {
    if (!isRingProduct) return
    for (const row of colorRows) {
      for (const purity of puritiesForProduct) {
        const cell = cells[buildCellKey(row.color_id, purity.id)]
        if (!hasRingWeightValue(cell?.gross_weight_g)) continue
        const variantRows = sizeStocks.filter(
          (entry) =>
            entry.color_id === row.color_id &&
            entry.purity_id === purity.id &&
            entry.size_type === 'ring_us',
        )
        const hasAnyVariantWeight = variantRows.some((entry) => hasRingWeightValue(entry.metal_weight_g))
        if (!hasAnyVariantWeight) {
          syncRingWeightForVariant(row.color_id, purity.id, '12', cell!.gross_weight_g)
        }
      }
    }
  }, [isRingProduct, colorRows, puritiesForProduct, cells, sizeStocks])

  useEffect(() => {
    if (!isChainProduct) return
    setSizeStocks((prev) => {
      let changed = false
      const next = [...prev]
      for (const chainLength of chainLengths) {
        const weight = chainLength.weight_g.trim()
        if (chainLength.length_inch.trim() === '' || weight === '') continue
        for (const row of colorRows) {
          for (const purity of puritiesForProduct) {
            const index = next.findIndex(
              (entry) =>
                entry.color_id === row.color_id &&
                entry.purity_id === purity.id &&
                entry.size_type === 'chain_inch' &&
                entry.size_label === chainLength.length_inch,
            )
            if (index >= 0) {
              if (next[index]!.metal_weight_g !== weight) {
                next[index] = {
                  ...next[index]!,
                  metal_weight_g: weight,
                }
                changed = true
              }
              continue
            }
            next.push(
              newSizeStockRow({
                color_id: row.color_id,
                purity_id: purity.id,
                size_label: chainLength.length_inch,
                size_type: 'chain_inch',
                metal_weight_g: weight,
              }),
            )
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [isChainProduct, chainLengths, colorRows, puritiesForProduct])

  function computeCellPrice(
    grossWeightText: string,
    purityCode: string,
    metalType: MetalPurity['metal'],
  ): { pureWeight: number | null; price: number | null } {
    const grossWeight = parseFloat(grossWeightText)
    if (!Number.isFinite(grossWeight) || grossWeight <= 0) {
      return { pureWeight: null, price: null }
    }

    const pureWeight = Math.round(grossWeight * 1000) / 1000
    if (!Number.isFinite(pureWeight) || pureWeight <= 0) {
      return { pureWeight: null, price: null }
    }

    const metalRate = resolveLiveRate(
      metalType ?? undefined,
      pricingContext.currentGoldPerGram,
      pricingContext.currentSilverPerGram,
      purityCode,
      pricingContext.goldPurityRates,
    )
    if (!Number.isFinite(metalRate) || metalRate <= 0) {
      return { pureWeight: null, price: null }
    }

    return {
      pureWeight,
      price: Math.round(pureWeight * metalRate * 100) / 100,
    }
  }

  function isMatrixVariantActive(colorId: string, purity: MetalPurity): boolean {
    const current = cells[buildCellKey(colorId, purity.id)]
    if (!current?.is_active) return false
    const computed = computeCellPrice(current.gross_weight_g, purity.code, purity.metal)
    return computed.pureWeight != null
  }

  function updateStoneRow(rowKey: string, updater: (row: StoneLineUi) => StoneLineUi) {
    setStoneRows((prev) => prev.map((row) => (row.key === rowKey ? updater(row) : row)))
  }

  function addStoneRow() {
    setStoneRows((prev) => [...prev, newStoneRow()])
  }

  function removeStoneRow(rowKey: string) {
    setStoneRows((prev) => {
      if (prev.length <= 1) return [newStoneRow()]
      return prev.filter((row) => row.key !== rowKey)
    })
  }

  function addStoneSize(rowKey: string) {
    updateStoneRow(rowKey, (row) => ({
      ...row,
      sizes: [...row.sizes, newStoneSizeRow()],
    }))
  }

  function updateStoneSize(rowKey: string, sizeKey: string, updater: (size: StoneSizeUi) => StoneSizeUi) {
    updateStoneRow(rowKey, (row) => ({
      ...row,
      sizes: row.sizes.map((size) => (size.key === sizeKey ? updater(size) : size)),
    }))
  }

  function removeStoneSize(rowKey: string, sizeKey: string) {
    updateStoneRow(rowKey, (row) => {
      if (row.sizes.length <= 1) {
        return { ...row, sizes: [newStoneSizeRow()] }
      }
      return { ...row, sizes: row.sizes.filter((size) => size.key !== sizeKey) }
    })
  }

  async function submit(nextStatus: 'draft' | 'active' | 'archived' | 'make_to_order') {
    if (!name.trim()) {
      toast.error('Product name required')
      return
    }
    if (!slug.trim()) {
      toast.error('Slug required')
      return
    }
    if (!categoryId) {
      toast.error('Category required')
      return
    }
    if (!designNumber.trim()) {
      toast.error('Design number required')
      return
    }

    const uniqColors = new Set(colorRows.map((row) => row.color_id))
    if (uniqColors.size !== colorRows.length) {
      toast.error('Each colour variant must use a distinct metal colour')
      return
    }

    const colorVariants = colorRows.map((row, index) => ({
      id: row.id,
      color_id: row.color_id,
      images: row.images,
      videos: row.videos,
      display_order: index,
    }))

    for (const row of colorVariants) {
      if (row.images.length === 0 && (row.videos?.length ?? 0) === 0) {
        toast.error('Each colour needs at least one image or video')
        return
      }
    }

    const matrix: Array<{
      id?: string
      color_id: string
      purity_id: string
      price?: number
      stock_qty: number
      is_active: boolean
      metal_weight_g: number
    }> = []

    for (const row of colorRows) {
      for (const purity of puritiesForProduct) {
        const current = cells[buildCellKey(row.color_id, purity.id)]
        if (!current) continue
        const grossWeightTrim = current.gross_weight_g.trim()
        const computed = computeCellPrice(grossWeightTrim, purity.code, purity.metal)
        if (computed.price == null || computed.pureWeight == null) {
          toast.error(`Price could not be calculated for ${purity.label}`)
          return
        }
        matrix.push({
          id: current.id,
          color_id: row.color_id,
          purity_id: purity.id,
          price: Math.round(computed.price * 100) / 100,
          stock_qty: nextStatus === 'make_to_order' ? 0 : Math.max(0, Math.floor(Number(current.stock_qty) || 0)),
          is_active: current.is_active,
          metal_weight_g: computed.pureWeight,
        })
      }
    }

    const sizeStocksPayload =
      isRingProduct || isChainProduct
        ? sizeStocks
            .filter((row) => {
              const purity = puritiesForProduct.find((entry) => entry.id === row.purity_id)
              return purity ? isMatrixVariantActive(row.color_id, purity) : false
            })
            .filter((row) => row.size_type === (isChainProduct ? 'chain_inch' : 'ring_us'))
            .map((row) => {
              const purity = puritiesForProduct.find((entry) => entry.id === row.purity_id)
              const baseMatrixWeightText = cells[buildCellKey(row.color_id, row.purity_id)]?.gross_weight_g ?? ''
              const parsedBaseMatrixWeight =
                baseMatrixWeightText.trim() !== '' && Number.isFinite(parseFloat(baseMatrixWeightText))
                  ? parseFloat(baseMatrixWeightText)
                  : null
              const parsedSizeWeight =
                row.metal_weight_g.trim() !== '' && Number.isFinite(parseFloat(row.metal_weight_g))
                  ? parseFloat(row.metal_weight_g)
                  : null
              const chainPriceOverride =
                row.size_type === 'chain_inch' &&
                parsedSizeWeight != null &&
                parsedBaseMatrixWeight != null &&
                purity
                  ? Math.round(
                      (parsedBaseMatrixWeight + parsedSizeWeight) *
                        resolveLiveRate(
                          purity.metal,
                          pricingContext.currentGoldPerGram,
                          pricingContext.currentSilverPerGram,
                          purity.code,
                          pricingContext.goldPurityRates,
                        ) *
                        100,
                    ) / 100
                  : null
              return {
                color_id: row.color_id,
                purity_id: row.purity_id,
                size_label: row.size_label.trim(),
                size_type: row.size_type,
                stock_qty: nextStatus === 'make_to_order' ? 0 : Math.max(0, Math.floor(Number(row.stock_qty) || 0)),
                metal_weight_g:
                  (row.size_type === 'ring_us' || row.size_type === 'chain_inch') && parsedSizeWeight != null
                    ? parsedSizeWeight
                    : null,
                price_override: chainPriceOverride,
                is_active: row.is_active,
              }
            })
            .filter((row) => row.size_label !== '')
        : []

    if (matrix.length === 0) {
      toast.error('Enter at least one variant with product weight (g)')
      return
    }

    setSaving(true)
    if (nextStatus === 'active') setPublishing(true)
    try {
      const productPayload = {
        name: name.trim(),
        slug: slug.trim(),
        category_id: categoryId,
        collection_id: primaryCollectionId || null,
        product_number: productNumber,
        design_number: designNumber.trim().toUpperCase() || null,
        product_code: productId || null,
        short_desc: shortDesc.trim() || null,
        description: description.trim() || null,
        diamond_shape: diamondShape.trim() || null,
        diamond_count: diamondCount ? parseInt(diamondCount, 10) : null,
        total_diamond_wt: totalWt ? parseFloat(totalWt) : null,
        diamond_color: diamondColor.trim() || null,
        diamond_clarity: diamondClarity.trim() || null,
        size_range: sizeRange.trim() || null,
        chain_lengths: isChainProduct
          ? chainLengths
              .map((row) => ({
                length_inch:
                  row.length_inch.trim() !== '' && Number.isFinite(parseFloat(row.length_inch))
                    ? parseFloat(row.length_inch)
                    : null,
                weight_g:
                  row.weight_g.trim() !== '' && Number.isFinite(parseFloat(row.weight_g))
                    ? parseFloat(row.weight_g)
                    : null,
              }))
              .filter((row) => row.length_inch != null && row.weight_g != null)
          : [],
        meta_title: metaTitle.trim() || null,
        meta_description: metaDesc.trim() || null,
        status: nextStatus,
        is_featured: featured,
        is_new_arrival: newArrival,
        is_best_seller: bestSeller,
        is_coming_soon: comingSoon,
        making_charge_pct:
          makingChargePct.trim() !== '' && Number.isFinite(parseFloat(makingChargePct))
            ? parseFloat(makingChargePct)
            : defaultMakingChargePct,
        has_stone: hasStone,
        stone_lines: hasStone
          ? stoneRows
              .map((row) => {
                const isDiamondStone = row.stone_type === 'diamond'
                const sizes = row.sizes
                  .map((size) => {
                    const cut_size = size.cut_size.trim()
                    const price_per_carat_inr =
                      !isDiamondStone &&
                      size.price_per_carat.trim() !== '' &&
                      Number.isFinite(parseFloat(size.price_per_carat))
                        ? parseFloat(size.price_per_carat)
                        : null
                    const rate_inr =
                      !isDiamondStone &&
                      size.rate.trim() !== '' &&
                      Number.isFinite(parseFloat(size.rate))
                        ? parseFloat(size.rate)
                        : price_per_carat_inr
                    const count =
                      size.count.trim() !== '' && Number.isFinite(parseInt(size.count, 10))
                        ? parseInt(size.count, 10)
                        : null
                    const weight =
                      size.weight.trim() !== '' && Number.isFinite(parseFloat(size.weight))
                        ? parseFloat(size.weight)
                        : null
                    const price_inr =
                      price_per_carat_inr != null && weight != null
                        ? price_per_carat_inr * weight
                        : rate_inr != null && count != null
                          ? rate_inr * count
                          : null
                    return { cut_size, count, weight, price_per_carat_inr, rate_inr, price_inr }
                  })
                  .filter((size) =>
                    size.cut_size !== '' ||
                    size.count != null ||
                    size.weight != null ||
                    size.price_per_carat_inr != null ||
                    size.rate_inr != null,
                  )

                const price_inr = sizes.reduce((total, size) => total + (size.price_inr ?? 0), 0)

                return {
                  stone_type: row.stone_type || null,
                  name:
                    row.stone_type === 'diamond'
                      ? 'diamond'
                      : row.stone_type === 'other_than_diamond'
                        ? 'other than diamond'
                        : '',
                  shape: row.shape.trim(),
                  color: row.color.trim(),
                  sizes,
                  total_weight: sizes.reduce((total, size) => total + (size.weight ?? 0), 0) > 0
                    ? Math.round(sizes.reduce((total, size) => total + (size.weight ?? 0), 0) * 1000) / 1000
                    : null,
                  price_inr: price_inr > 0 ? price_inr : null,
                }
              })
              .filter((row) => row.stone_type != null || row.shape !== '' || row.color !== '' || row.sizes.length > 0)
          : [],
      }

      const res = await fetch(isEdit ? `/api/products/${initialData.id}` : '/api/products/catalog', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: productPayload,
          collection_ids: selectedCollectionIds,
          tag_ids: tagIds,
          color_variants: colorVariants,
          matrix,
          size_stocks: sizeStocksPayload,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? res.statusText)

      if (nextStatus === 'active') {
        setJustPublished(true)
        setStatus('active')
        toast.success('Product published')
        if (!isEdit && body.id) {
          router.push(`/products/${body.id}`)
        } else if (isEdit) {
          router.refresh()
        }
      } else {
        toast.success(nextStatus === 'archived' ? 'Product archived' : 'Draft saved')
        router.push(body.id ? `/products/${body.id}` : isEdit ? `/products/${initialData.id}` : '/products')
        router.refresh()
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
      setPublishing(false)
    }
  }

  const showBulkImportHint = isEdit && isBulkImportPlaceholder(shortDesc)

  return (
    <div className="space-y-10 pb-24">
      {showBulkImportHint && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-900">
          <p className="font-medium">Bulk import — incomplete listing</p>
          <p className="mt-1 text-amber-800">
            This product was imported from Excel with placeholder fields. Add a short description, images per colour,
            stock, and other details before publishing.
          </p>
        </div>
      )}
      <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
        <h3 className="font-display text-lg text-deep-teal">Basic info</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Product name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Slug</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlugManual(true)
                setSlug(e.target.value)
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name} ({category.code ?? '—'})</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 space-y-2">
            <span className="text-xs text-ink-muted block">Collections (optional)</span>
            {collections.length === 0 ? (
              <p className="text-xs text-ink-faint">No collections — create in Taxonomy Manager</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {collections.map((collection) => {
                  const active = selectedCollectionIds.includes(collection.id)
                  return (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => toggleCollection(collection.id)}
                      className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                        active
                          ? 'border-deep-teal bg-deep-teal/10 text-deep-teal font-medium'
                          : 'border-divider text-ink-muted hover:border-teal/40'
                      }`}
                    >
                      {collection.name}
                      {active && <span className="ml-1 opacity-70">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedCollectionIds.length > 0 && (
              <label className="block space-y-1 mt-2">
                <span className="text-xs text-ink-muted">Primary collection (URL)</span>
                <select
                  value={primaryCollectionId}
                  onChange={(e) => setPrimaryCollectionId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm max-w-xs"
                >
                  {selectedCollectionIds.map((id) => {
                    const col = collections.find((c) => c.id === id)
                    return (
                      <option key={id} value={id}>{col?.name ?? id}</option>
                    )
                  })}
                </select>
              </label>
            )}
          </div>
          {tags.length > 0 && (
            <div className="sm:col-span-2 space-y-2">
              <span className="text-xs text-ink-muted block">Tags</span>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = tagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                        active ? 'text-white shadow-sm' : 'text-ink-muted'
                      }`}
                      style={
                        active
                          ? { backgroundColor: tag.color ?? '#94A3B8', borderColor: tag.color ?? '#94A3B8' }
                          : { borderColor: tag.color ?? '#e2e8f0' }
                      }
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: tag.color ?? '#94a3b8', opacity: active ? 0.6 : 1 }}
                      />
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Base metal</span>
            <select
              value={productMetalType}
              disabled={isEdit}
              title={isEdit ? 'Metal is fixed from existing variants' : undefined}
              onChange={(e) => {
                const next = e.target.value as 'gold' | 'silver'
                setProductMetalType(next)
                toast.message(
                  next === 'gold'
                    ? 'Matrix columns: gold purities (e.g. 22Kt / 18Kt / 14Kt / 9Kt)'
                    : 'Matrix columns: silver purities (925 / 835)',
                )
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
            </select>
            {isEdit && (
              <span className="text-[11px] text-ink-faint">Do not change the metal type through editing — create a new product whenever the metal is different.
</span>
            )}
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Design number</span>
            <input
              value={designNumber}
              onChange={(e) => setDesignNumber(e.target.value.toUpperCase())}
              placeholder="e.g. AMI-2041"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Product ID</span>
            <input
              value={productId || 'Auto-generated from category + design number'}
              readOnly
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono bg-surface text-ink-muted"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Making charge %</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={makingChargePct}
              onChange={(e) => setMakingChargePct(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="make_to_order">Make to order</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded accent-teal" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newArrival} onChange={(e) => setNewArrival(e.target.checked)} className="rounded accent-teal" />
              New arrival
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bestSeller} onChange={(e) => setBestSeller(e.target.checked)} className="rounded accent-teal" />
              Best seller
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} className="rounded accent-teal" />
              Coming soon
            </label>
          </div>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-ink-muted">Short description</span>
            <input value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-ink-muted">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
          </label>
        </div>
      </section>

      {/* Diamond specifications section hidden — fields replaced by Stine (gem) section below */}

      <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
        <h3 className="font-display text-lg text-deep-teal">Stone (gem)</h3>
        <label className="block space-y-1 max-w-md">
          <span className="text-xs text-ink-muted">Does this product include stone(s)?</span>
          <select
            value={hasStone ? 'yes' : 'no'}
            onChange={(e) => {
              const yes = e.target.value === 'yes'
              setHasStone(yes)
              if (yes && stoneRows.length === 0) setStoneRows([newStoneRow()])
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>

        {hasStone && (
          <div className="space-y-4">
            {stoneRows.map((row, idx) => {
              const isDiamondStone = row.stone_type === 'diamond'
              const rowTotalPcs = row.sizes.reduce((total, size) => {
                const countNum = parseInt(size.count, 10)
                if (!Number.isFinite(countNum) || countNum <= 0) return total
                return total + countNum
              }, 0)
              const rowTotalWeight = row.sizes.reduce((total, size) => {
                const weightNum = parseFloat(size.weight)
                if (!Number.isFinite(weightNum) || weightNum <= 0) return total
                return total + weightNum
              }, 0)
              const rowTotal = row.sizes.reduce((total, size) => {
                const pricePerCaratNum = parseFloat(size.price_per_carat)
                const rateNum = parseFloat(size.rate)
                const countNum = parseInt(size.count, 10)
                const weightNum = parseFloat(size.weight)
                if (!isDiamondStone && Number.isFinite(pricePerCaratNum) && Number.isFinite(weightNum) && weightNum > 0) {
                  return total + pricePerCaratNum * weightNum
                }
                if (!Number.isFinite(rateNum) || !Number.isFinite(countNum) || countNum <= 0) return total
                return total + rateNum * countNum
              }, 0)
              const stoneInp = 'w-full border rounded-lg px-3 py-2 text-sm'
              const update = (field: Partial<Omit<StoneLineUi, 'key' | 'sizes'>>) =>
                setStoneRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, ...field } : r)))
              return (
                <div key={row.key} className="border border-divider rounded-xl p-4 space-y-4 bg-surface/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
                        {stoneTypeLabel(row.stone_type)} {idx + 1}
                      </span>
                      <p className="text-xs text-ink-faint mt-1">Add multiple cut / size rows under one stone.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (stoneRows.length <= 1) {
                          setStoneRows([newStoneRow()])
                          return
                        }
                        setStoneRows((prev) => prev.filter((r) => r.key !== row.key))
                      }}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      aria-label="Remove stone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Stone</span>
                      <select
                        value={row.stone_type}
                        onChange={(e) =>
                          setStoneRows((prev) =>
                            prev.map((r) =>
                              r.key !== row.key
                                ? r
                                : {
                                    ...r,
                                    stone_type: e.target.value as StoneTypeUi,
                                    sizes:
                                      e.target.value === 'diamond'
                                        ? r.sizes.map((size) => ({ ...size, price_per_carat: '', rate: '' }))
                                        : r.sizes,
                                  },
                            ),
                          )
                        }
                        className={stoneInp}
                      >
                        <option value="">Select stone</option>
                        <option value="diamond">Diamond</option>
                        <option value="other_than_diamond">Other than diamond</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Shape</span>
                      <select
                        value={row.shape}
                        onChange={(e) => update({ shape: e.target.value })}
                        className={stoneInp}
                      >
                        <option value="">Select shape</option>
                        {DIAMOND_SHAPE_OPTIONS.map((shape) => (
                          <option key={shape} value={shape}>
                            {shape}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Color</span>
                      <input
                        value={row.color}
                        onChange={(e) => update({ color: e.target.value })}
                        className={stoneInp}
                        placeholder="e.g. D"
                      />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:col-span-2">
                      <div className="w-full rounded-lg border border-divider bg-white px-3 py-2 text-sm text-ink-muted">
                        Total pcs: {rowTotalPcs > 0 ? rowTotalPcs : '—'}
                      </div>
                      <div className="w-full rounded-lg border border-divider bg-white px-3 py-2 text-sm text-ink-muted">
                        Total weight: {rowTotalWeight > 0 ? `${rowTotalWeight.toFixed(3)} ct` : '—'}
                      </div>
                      <div className="w-full rounded-lg border border-divider bg-white px-3 py-2 text-sm text-ink-muted sm:col-span-2">
                        Total value: {isDiamondStone ? 'Live diamond price se auto-calculate hoga' : rowTotal > 0 ? `₹${rowTotal.toLocaleString('en-IN')}` : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">Cut / size rows</h4>
                      <button
                        type="button"
                        onClick={() => addStoneSize(row.key)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed border-teal text-teal hover:bg-teal/5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add size
                      </button>
                    </div>

                    <div className="space-y-3">
                      {row.sizes.map((size, sizeIndex) => {
                        const pricePerCaratNum = parseFloat(size.price_per_carat)
                        const rateNum = parseFloat(size.rate)
                        const countNum = parseInt(size.count, 10)
                        const weightNum = parseFloat(size.weight)
                        const price =
                          Number.isFinite(pricePerCaratNum) && Number.isFinite(weightNum) && weightNum > 0
                            ? pricePerCaratNum * weightNum
                            : Number.isFinite(rateNum) && Number.isFinite(countNum) && countNum > 0
                              ? rateNum * countNum
                              : null
                        return (
                          <div key={size.key} className="rounded-lg border border-divider bg-white p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-ink-muted">Size {sizeIndex + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeStoneSize(row.key, size.key)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                aria-label="Remove size"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="block space-y-1">
                                <span className="text-xs text-ink-muted">Cut / size</span>
                                <input
                                  value={size.cut_size}
                                  onChange={(e) => updateStoneSize(row.key, size.key, (current) => ({ ...current, cut_size: e.target.value }))}
                                  className={stoneInp}
                                  placeholder="e.g. Round 0.5 ct"
                                />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs text-ink-muted">Pcs</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={size.count}
                                  onChange={(e) => updateStoneSize(row.key, size.key, (current) => ({ ...current, count: e.target.value }))}
                                  className={stoneInp}
                                  placeholder="0"
                                />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs text-ink-muted">Weight</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.001"
                                  value={size.weight}
                                  onChange={(e) => updateStoneSize(row.key, size.key, (current) => ({ ...current, weight: e.target.value }))}
                                  className={stoneInp}
                                  placeholder="0.000"
                                />
                              </label>
                              {!isDiamondStone && (
                                <label className="block space-y-1">
                                  <span className="text-xs text-ink-muted">Price / ct (₹)</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={size.price_per_carat}
                                    onChange={(e) => updateStoneSize(row.key, size.key, (current) => ({ ...current, price_per_carat: e.target.value, rate: e.target.value }))}
                                    className={stoneInp}
                                    placeholder="0"
                                  />
                                </label>
                              )}
                            </div>
                            <div className="text-xs text-ink-muted">
                              Size total: {isDiamondStone ? 'Live diamond price se auto-calculate hoga' : price != null ? `₹${price.toLocaleString('en-IN')}` : '—'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => setStoneRows((prev) => [...prev, newStoneRow()])}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 border border-dashed border-teal text-teal rounded-lg hover:bg-teal/5 transition-colors w-full justify-center"
            >
              <Plus className="w-4 h-4" /> Add stone
            </button>
          </div>
        )}
      </section>

      {isGoldProduct && (
      <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-deep-teal">Colour variants &amp; images</h3>
          <button
            type="button"
            onClick={addColorRow}
            disabled={!hasMetalColors}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 bg-teal text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Add colour
          </button>
        </div>
        {!hasMetalColors && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            `metal_colors` table empty hai. Supabase me seed run karo, phir yahan Rose Gold / White Gold / Yellow Gold rows auto-load ho jayengi.
          </div>
        )}
        {colorRows.length === 0 && hasMetalColors && (
          <p className="text-sm text-ink-muted">Add one row per jewellery colour. Har colour row me images aur videos upload ho sakte hain.</p>
        )}
        <div className="space-y-6">
          {colorRows.map((row) => {
            const metalColor = metalColors.find((color) => color.id === row.color_id)
            return (
              <div key={row.key} className="border border-divider rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={row.color_id}
                    onChange={(e) =>
                      setColorRows((prev) =>
                        prev.map((entry) => (entry.key === row.key ? { ...entry, color_id: e.target.value } : entry)),
                      )
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    {metalColors.map((color) => (
                      <option key={color.id} value={color.id}>{color.label} ({color.code})</option>
                    ))}
                  </select>
                  {metalColor?.hex && (
                    <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
                      Preview <span className="h-8 w-8 rounded-full border shadow-sm" style={{ backgroundColor: metalColor.hex }} />
                    </span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    <button type="button" className="p-1 rounded border" onClick={() => moveColorRow(row.key, -1)} aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
                    <button type="button" className="p-1 rounded border" onClick={() => moveColorRow(row.key, 1)} aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
                    <button type="button" className="p-1 rounded border text-red-600" onClick={() => removeColorRow(row.key)} aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <VariantColorMedia
                  rowKey={row.key}
                  images={row.images}
                  videos={row.videos}
                  uploading={uploading}
                  onPickImages={onPickFiles}
                  onPickVideos={onPickVideos}
                  onRemoveImage={removeImage}
                  onRemoveVideo={removeVideo}
                  onReorderImage={reorderImage}
                />
              </div>
            )
          })}
        </div>
      </section>
      )}

      {!isGoldProduct && (
        <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
          <h3 className="font-display text-lg text-deep-teal">Product images</h3>
          <p className="text-sm text-ink-muted">
            Silver items use one gallery — no gold colour rows. Kam se kam ek image ya video zaroori hai.
          </p>
          {!hasMetalColors && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              `metal_colors` empty hai. Pehle migration <code className="font-mono text-xs">013_sterling_silver_metal_color.sql</code> run karo (Sterling Silver / SV).
            </div>
          )}
          {colorRows[0] && (
            <div className="border border-divider rounded-lg p-4 space-y-3">
              <VariantColorMedia
                rowKey={colorRows[0]!.key}
                images={colorRows[0]!.images}
                videos={colorRows[0]!.videos}
                uploading={uploading}
                onPickImages={onPickFiles}
                onPickVideos={onPickVideos}
                onRemoveImage={removeImage}
                onRemoveVideo={removeVideo}
                onReorderImage={reorderImage}
              />
            </div>
          )}
        </section>
      )}

      <section className="bg-white rounded-xl border border-divider p-6 space-y-4 overflow-x-auto">
        <h3 className="font-display text-lg text-deep-teal">Weight &amp; stock matrix</h3>
        {/* <p className="text-sm text-ink-muted">
          Top field mein direct metal weight dalo. Neeche calculated price auto-update hoga current kt rate aur making charge ke hisaab se.
        </p> */}
        {!hasMetalPurities ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            `metal_purities` table empty hai. Supabase me seed / migration chalao — gold (22/18/14/09) aur silver (925/835) columns yahan dikhenge.
          </div>
        ) : puritiesForProduct.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Is base metal ke liye DB me koi active purity nahi. `012_metal_purity_metal_type` migration run karo ya Supabase me silver rows add karo.
          </div>
        ) : colorRows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {isGoldProduct
              ? 'Pehle colour rows banao. Har purity column me weight aur stock set karo.'
              : 'Silver: upar Product images section complete karo — phir yahan weight set karo.'}
          </p>
        ) : (
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr>
                {isGoldProduct && <th className="text-left px-2 py-2 border-b">Colour</th>}
                {puritiesForProduct.map((purity) => (
                  <th key={purity.id} className="text-left px-2 py-2 border-b whitespace-nowrap">{purity.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colorRows.map((row) => {
                const color = metalColors.find((entry) => entry.id === row.color_id)
                return (
                  <tr key={row.key}>
                    {isGoldProduct && (
                      <td className="px-2 py-3 border-b align-top font-medium">{color?.label ?? row.color_id}</td>
                    )}
                    {puritiesForProduct.map((purity) => {
                      const cell = cells[buildCellKey(row.color_id, purity.id)] ?? {
                        gross_weight_g: '',
                        stock_qty: DEFAULT_STOCK_QTY,
                        is_active: false,
                        seed_price: undefined,
                      }
                      const computedPrice = computeCellPrice(cell.gross_weight_g, purity.code, purity.metal)
                      const displayPrice = computedPrice.price ?? cell.seed_price ?? null
                      const isCellComplete = computedPrice.pureWeight != null
                      const isCellActive = isCellComplete && cell.is_active
                      return (
                        <td key={purity.id} className="px-2 py-2 border-b align-top min-w-[11rem]">
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            placeholder="Metal weight (g)"
                            value={cell.gross_weight_g}
                            onChange={(e) => {
                              const nextWeight = e.target.value
                              if (isRingProduct) {
                                setCellValue(row.color_id, purity.id, (current) => ({
                                  ...current,
                                  gross_weight_g: nextWeight,
                                }))
                                syncRingWeightForVariant(row.color_id, purity.id, '12', nextWeight)
                              } else if (isGoldProduct) {
                                syncGoldMatrixWeightByPurity(purity.id, nextWeight)
                              } else {
                                syncMatrixWeightAcrossAllCells(nextWeight)
                              }
                            }}
                            className="w-full border rounded px-2 py-1 mb-2"
                          />
                          <div className="w-full border rounded px-2 py-1 mb-2 bg-white text-sm text-ink-muted">
                            Entered metal weight: {cell.gross_weight_g.trim() !== '' ? `${Number(cell.gross_weight_g).toFixed(3)} g` : '—'}
                          </div>
                          <div className="w-full border rounded px-2 py-1 mb-2 bg-surface text-sm text-ink-muted">
                            Metal price: {displayPrice != null ? formatINR(displayPrice) : '—'}
                          </div>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Pcs"
                            value={cell.stock_qty}
                            onChange={(e) => setCellValue(row.color_id, purity.id, (current) => ({ ...current, stock_qty: e.target.value }))}
                            className="w-full border rounded px-2 py-1 mb-2"
                          />
                          <label className="flex items-center gap-2 text-xs text-ink-muted mb-2">
                            <input
                              type="checkbox"
                              checked={isCellActive}
                              disabled={!isCellComplete}
                              onChange={(e) => setCellValue(row.color_id, purity.id, (current) => ({ ...current, is_active: e.target.checked }))}
                            />
                            Active variant
                          </label>
                          {!isCellComplete && (
                            <p className="mb-2 text-[11px] text-ink-faint">
                              Add product weight to enable this variant.
                            </p>
                          )}
                          {color?.code ? (
                            <p className="text-[11px] text-ink-faint font-mono break-all">
                              {skuPreview(color.code, purity.code)}
                            </p>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {isChainProduct && (
        <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg text-deep-teal">Chain lengths</h3>
            <span className="text-xs uppercase tracking-widest text-ink-faint">14 / 16 / 18 / 20 / 22 in</span>
          </div>
          {/* <p className="text-sm text-ink-muted">
            Har length ke liye weight daalo. Frontend par user length choose karega aur price live auto-calculate hoga.
          </p> */}
          <div className="space-y-3">
            {chainLengths.map((row, index) => (
              <div key={row.key} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3 rounded-lg border border-divider bg-surface/40 p-4">
                <label className="block space-y-1">
                  <span className="text-xs text-ink-muted uppercase tracking-wider">Length (inch)</span>
                  <select
                    value={row.length_inch}
                    onChange={(e) => updateChainLength(row.key, (current) => ({ ...current, length_inch: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select length</option>
                    {CHAIN_LENGTH_OPTIONS.map((length) => (
                      <option key={length} value={length}>{length}"</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-ink-muted uppercase tracking-wider">Weight (g)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={row.weight_g}
                    onChange={(e) => updateChainLength(row.key, (current) => ({ ...current, weight_g: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="0.000"
                  />
                </label>
                {/* <p className="sm:col-span-2 text-xs text-ink-faint">
                  Row {index + 1}: price product page par selected purity ke basis par auto calculate hoga.
                </p> */}
              </div>
            ))}
          </div>
        </section>
      )}

      {(isRingProduct || isChainProduct) && (
        <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg text-deep-teal">
              {isChainProduct ? 'Chain stock & price matrix' : 'Ring size stock matrix'}
            </h3>
            <span className="text-xs uppercase tracking-widest text-ink-faint">
              {isChainProduct ? '14 / 16 / 18 / 20 / 22 in' : '6 / 7 / 8 / 9 / 10 / 11 / 12 / 13 / 14 / 15 / 16 / 17 / 18 / 19 / 20 / 21 / 22 / 23 / 24 / 25 / 26 / 27 / 28'}
            </span>
          </div>
          {/* <p className="text-sm text-ink-muted">
            Har variant ke liye size-wise stock maintain karo. Chains me manual price bhi yahi dalna hai; frontend ussi ko final price me add karega.
          </p> */}
          <div className="space-y-4">
            {puritiesForProduct.map((purity, purityIndex) => {
              const activeColorColumns = colorRows
                .map((row) => ({
                  row,
                  color: metalColors.find((entry) => entry.id === row.color_id),
                }))
                .filter(({ row }) => isMatrixVariantActive(row.color_id, purity))

              if (activeColorColumns.length === 0) return null

              return (
                <details
                  key={purity.id}
                  open={purityIndex === 0}
                  className="group rounded-2xl border border-divider bg-white shadow-sm"
                >
                  <summary className="cursor-pointer list-none px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="font-display text-lg text-deep-teal">{purity.label}</p>
                          <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                            {activeColorColumns.length} colours
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-muted">
                          {activeColorColumns.map(({ color }) => color?.label ?? '').filter(Boolean).join(' / ')} · {(isChainProduct ? CHAIN_LENGTH_OPTIONS : RING_SIZE_OPTIONS).length} rows
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ink-faint">
                        <span>click to expand</span>
                        <span className="text-lg leading-none transition-transform group-open:rotate-180">⌄</span>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-divider px-5 py-5">
                    <div
                      className={`grid gap-4 ${
                        activeColorColumns.length === 1
                          ? 'grid-cols-1'
                          : activeColorColumns.length === 2
                            ? 'grid-cols-1 xl:grid-cols-2'
                            : 'grid-cols-1 xl:grid-cols-3'
                      }`}
                    >
                      {activeColorColumns.map(({ row, color }) => {
                        const entries = sizeStocks
                          .filter(
                            (entry) =>
                              entry.color_id === row.color_id &&
                              entry.purity_id === purity.id &&
                              entry.size_type === (isChainProduct ? 'chain_inch' : 'ring_us'),
                          )
                          .slice()
                          .sort((a, b) => Number(a.size_label) - Number(b.size_label))

                        return (
                          <div
                            key={`${purity.id}-${row.color_id}`}
                            className="overflow-hidden rounded-2xl border border-divider bg-surface/30"
                          >
                            <div className="flex items-center justify-between gap-3 border-b border-divider bg-white px-4 py-3">
                              <div>
                                <p className="font-medium text-ink">{color?.label ?? row.color_id}</p>
                                <p className="text-[11px] text-ink-faint font-mono break-all">
                                  {skuPreview(color?.code ?? '', purity.code)}
                                </p>
                              </div>
                              <span className="rounded-full border border-divider bg-surface px-2.5 py-1 text-[11px] uppercase tracking-wide text-ink-muted">
                                {entries.length} rows
                              </span>
                            </div>

                            <div className="grid grid-cols-[52px_100px_120px_130px_88px] gap-2 border-b border-divider bg-surface/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                              <span>Size</span>
                              <span>Stock</span>
                              <span>Weight</span>
                              <span>Price</span>
                              <span>Active</span>
                            </div>

                            <div className="max-h-[42rem] overflow-y-auto px-3 py-3 space-y-2">
                              {(isChainProduct ? CHAIN_LENGTH_OPTIONS : RING_SIZE_OPTIONS).map((sizeLabel) => {
                                const current = entries.find((entry) => entry.size_label === sizeLabel)
                                const baseMatrixWeight = cells[buildCellKey(row.color_id, purity.id)]?.gross_weight_g ?? ''
                                const sharedChainWeight =
                                  chainLengths.find((entry) => String(entry.length_inch) === sizeLabel)?.weight_g ?? ''
                                const sharedRingWeight =
                                  sizeStocks.find(
                                    (entry) =>
                                      entry.color_id === row.color_id &&
                                      entry.size_type === 'ring_us' &&
                                      entry.size_label === sizeLabel &&
                                      entry.metal_weight_g.trim() !== '',
                                  )?.metal_weight_g ?? ''
                                const chainWeight = current?.metal_weight_g?.trim() ? current.metal_weight_g : sharedChainWeight
                                const ringWeight = current?.metal_weight_g?.trim() ? current.metal_weight_g : sharedRingWeight
                                const chainBasePrice =
                                  isChainProduct
                                    ? baseMatrixWeight.trim() !== '' &&
                                      chainWeight.trim() !== '' &&
                                      Number.isFinite(parseFloat(baseMatrixWeight)) &&
                                      Number.isFinite(parseFloat(chainWeight))
                                      ? Math.round(
                                          (parseFloat(baseMatrixWeight) + parseFloat(chainWeight)) *
                                            resolveLiveRate(
                                              purity.metal,
                                              pricingContext.currentGoldPerGram,
                                              pricingContext.currentSilverPerGram,
                                              purity.code,
                                              pricingContext.goldPurityRates,
                                            ) *
                                            100,
                                        ) / 100
                                      : null
                                    : null
                                const ringBasePrice =
                                  isChainProduct
                                    ? null
                                    : ringWeight.trim() !== '' && Number.isFinite(parseFloat(ringWeight))
                                      ? Math.round(
                                          parseFloat(ringWeight) *
                                            resolveLiveRate(
                                              purity.metal,
                                              pricingContext.currentGoldPerGram,
                                              pricingContext.currentSilverPerGram,
                                              purity.code,
                                              pricingContext.goldPurityRates,
                                            ) *
                                            100,
                                        ) / 100
                                      : null

                                return (
                                  <div
                                    key={`${purity.id}-${row.color_id}-${sizeLabel}`}
                                    className="grid grid-cols-[52px_100px_120px_130px_88px] items-center gap-2 rounded-xl border border-divider bg-white px-2 py-2.5"
                                  >
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-divider bg-surface text-sm font-medium text-ink">
                                      {sizeLabel}
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={current?.stock_qty ?? DEFAULT_STOCK_QTY}
                                      onChange={(e) =>
                                        updateSizeStock(row.color_id, purity.id, sizeLabel, (existing) => ({
                                          ...existing,
                                          stock_qty: e.target.value,
                                        }))
                                      }
                                      className="w-full border rounded-lg px-3 py-2 text-sm"
                                      placeholder="Stock"
                                    />
                                    {isChainProduct ? (
                                      <input
                                        type="number"
                                        min={0}
                                        step="0.001"
                                        value={chainWeight}
                                        onChange={(e) =>
                                          syncChainLengthWeight(sizeLabel, e.target.value)
                                        }
                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                        placeholder="Weight (g)"
                                      />
                                    ) : (
                                      <input
                                        type="number"
                                        min={0}
                                        step="0.001"
                                        value={ringWeight}
                                        onChange={(e) =>
                                          syncRingWeightAcrossPurities(row.color_id, sizeLabel, e.target.value)
                                        }
                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                        placeholder="Weight (g)"
                                      />
                                    )}
                                    <div className="rounded-lg border border-divider bg-surface px-3 py-2 text-sm text-ink-muted">
                                      {isChainProduct
                                        ? chainBasePrice != null ? formatINR(chainBasePrice) : '—'
                                        : ringBasePrice != null ? formatINR(ringBasePrice) : '—'}
                                    </div>
                                    <label className="flex items-center justify-center gap-2 text-xs text-ink-muted">
                                      <input
                                        type="checkbox"
                                        checked={current?.is_active ?? true}
                                        onChange={(e) =>
                                          updateSizeStock(row.color_id, purity.id, sizeLabel, (existing) => ({
                                            ...existing,
                                            is_active: e.target.checked,
                                          }))
                                        }
                                      />
                                      <span className="hidden 2xl:inline">Active</span>
                                    </label>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      )}

      <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
        <h3 className="font-display text-lg text-deep-teal">SEO &amp; publish</h3>
        <label className="block space-y-1"><span className="text-xs text-ink-muted">Meta title</span>
          <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
        <label className="block space-y-1"><span className="text-xs text-ink-muted">Meta description</span>
          <textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit(status)}
            className="px-5 py-2.5 rounded-lg border border-divider text-sm font-medium hover:bg-surface"
          >
            {saving ? 'Saving…' : isEdit ? 'Update product' : 'Save'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit('draft')}
            className="px-5 py-2.5 rounded-lg border border-divider text-sm font-medium hover:bg-surface"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={saving || (status === 'active' && justPublished)}
            onClick={() => void submit(status)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              status === 'active' && justPublished
                ? 'bg-teal/80 text-white cursor-default'
                : 'bg-teal text-white hover:bg-deep-teal'
            }`}
          >
            {publishing && saving
              ? 'Publishing…'
              : status === 'active'
                ? (justPublished ? 'Published' : 'Publish')
                : status === 'archived'
                  ? 'Archive Product'
                  : 'Save as Draft'}
          </button>
        </div>
      </section>
    </div>
  )
}
