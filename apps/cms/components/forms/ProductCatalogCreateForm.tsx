'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronUp, ChevronDown, X, Film } from 'lucide-react'
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload'
import { generateAmioraSKU, slugifyName } from '@/lib/sku'
import { isBulkImportPlaceholder } from '@/lib/bulkImportConstants'

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
    product_number: number
    design_number: string | null
    short_desc: string | null
    description: string | null
    diamond_shape: string | null
    diamond_count: number | null
    total_diamond_wt: number | null
    diamond_color: string | null
    diamond_clarity: string | null
    size_range: string | null
    metal_weight_g?: number | null
    meta_title: string | null
    meta_description: string | null
    status: 'draft' | 'active' | 'archived'
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
}

type CellState = {
  id?: string
  metal_weight_g: string
  stock_qty: string
  is_active: boolean
}

function buildCellKey(colorId: string, purityId: string) {
  return `${colorId}:${purityId}`
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

function buildCellState(matrix: MatrixSeedCell[], fallbackWeightG?: number | null) {
  const fallback =
    fallbackWeightG != null && Number.isFinite(Number(fallbackWeightG))
      ? String(Number(fallbackWeightG))
      : ''
  return Object.fromEntries(
    matrix.map((cell) => [
      buildCellKey(cell.color_id, cell.purity_id),
      {
        id: cell.id,
        metal_weight_g:
          cell.metal_weight_g != null && Number.isFinite(Number(cell.metal_weight_g))
            ? String(Number(cell.metal_weight_g))
            : fallback,
        stock_qty: String(cell.stock_qty),
        is_active: cell.is_active,
      } satisfies CellState,
    ]),
  ) as Record<string, CellState>
}

type StoneLineUi = {
  key:      string
  name:     string
  cut_size: string
  shape:    string
  color:    string
  count:    string
  rate:     string
}

function stoneLinesFromDb(raw: unknown): StoneLineUi[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((item, i) => {
    const o = item as Record<string, unknown>
    const name     = typeof o.name     === 'string' ? o.name     : ''
    const cut_size = typeof o.cut_size === 'string' ? o.cut_size : ''
    const shape    = typeof o.shape    === 'string' ? o.shape    : ''
    const color    = typeof o.color    === 'string' ? o.color    : ''
    const rateRaw  = o.rate_inr
    const rateStr  =
      typeof rateRaw === 'number' && Number.isFinite(rateRaw)
        ? String(rateRaw)
        : typeof rateRaw === 'string' && rateRaw.trim() !== ''
          ? rateRaw
          : ''
    const countRaw = o.count
    const countStr =
      typeof countRaw === 'number' && Number.isFinite(countRaw)
        ? String(countRaw)
        : typeof countRaw === 'string' && countRaw.trim() !== ''
          ? countRaw
          : ''
    return { key: `st-${i}-${name.slice(0, 8)}`, name, cut_size, shape, color, count: countStr, rate: rateStr }
  })
}

function newStoneRow(): StoneLineUi {
  return {
    key: `st-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: '', cut_size: '', shape: '', color: '', count: '', rate: '',
  }
}

export function ProductCatalogCreateForm({
  categories,
  collections,
  tags = [],
  metalColors,
  metalPurities,
  initialData,
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

  const [metaTitle, setMetaTitle] = useState(initialData?.product.meta_title ?? '')
  const [metaDesc, setMetaDesc] = useState(initialData?.product.meta_description ?? '')
  const [featured, setFeatured] = useState(initialData?.product.is_featured ?? false)
  const [newArrival, setNewArrival] = useState(initialData?.product.is_new_arrival ?? false)
  const [bestSeller, setBestSeller] = useState(initialData?.product.is_best_seller ?? false)
  const [comingSoon, setComingSoon] = useState(initialData?.product.is_coming_soon ?? false)
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(initialData?.product.status ?? 'draft')
  const [makingChargePct, setMakingChargePct] = useState<string>(
    String(initialData?.product.making_charge_pct ?? 8),
  )

  const [hasStone, setHasStone] = useState(() => Boolean(initialData?.product.has_stone))
  const [stoneRows, setStoneRows] = useState<StoneLineUi[]>(() => {
    const rows = stoneLinesFromDb(initialData?.product.stone_lines)
    return rows.length > 0 ? rows : []
  })

  useEffect(() => {
    if (!hasStone) return
    setStoneRows((prev) => (prev.length === 0 ? [newStoneRow()] : prev))
  }, [hasStone])

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

  const [cells, setCells] = useState<Record<string, CellState>>(
    buildCellState(initialData?.matrix ?? [], initialData?.product.metal_weight_g),
  )
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [justPublished, setJustPublished] = useState(false)

  const categoryCode = categories.find((c) => c.id === categoryId)?.code ?? 'XX'

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
      const current = prev[key] ?? { metal_weight_g: '', stock_qty: '1', is_active: true }
      return { ...prev, [key]: updater(current) }
    })
  }

  async function submit(nextStatus: 'draft' | 'active' | 'archived') {
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
      stock_qty: number
      is_active: boolean
      metal_weight_g: number
    }> = []

    for (const row of colorRows) {
      for (const purity of puritiesForProduct) {
        const current = cells[buildCellKey(row.color_id, purity.id)]
        if (!current) continue
        const weightTrim = current.metal_weight_g.trim()
        const weightParsed = weightTrim !== '' ? parseFloat(weightTrim) : NaN
        if (!Number.isFinite(weightParsed) || weightParsed <= 0) continue
        matrix.push({
          id: current.id,
          color_id: row.color_id,
          purity_id: purity.id,
          stock_qty: Math.max(0, Math.floor(Number(current.stock_qty) || 0)),
          is_active: current.is_active,
          metal_weight_g: weightParsed,
        })
      }
    }

    if (matrix.length === 0) {
      toast.error('Enter at least one variant with metal weight (g)')
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
        design_number: designNumber.trim() || null,
        short_desc: shortDesc.trim() || null,
        description: description.trim() || null,
        diamond_shape: diamondShape.trim() || null,
        diamond_count: diamondCount ? parseInt(diamondCount, 10) : null,
        total_diamond_wt: totalWt ? parseFloat(totalWt) : null,
        diamond_color: diamondColor.trim() || null,
        diamond_clarity: diamondClarity.trim() || null,
        size_range: sizeRange.trim() || null,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDesc.trim() || null,
        status: nextStatus,
        is_featured: featured,
        is_new_arrival: newArrival,
        is_best_seller: bestSeller,
        is_coming_soon: comingSoon,
        has_stone: hasStone,
        stone_lines: hasStone
          ? stoneRows
              .map((r) => {
                const rate_inr  = r.rate.trim()  !== '' ? (Number.isFinite(parseFloat(r.rate))  ? parseFloat(r.rate)  : null) : null
                const count     = r.count.trim() !== '' ? (Number.isFinite(parseInt(r.count))   ? parseInt(r.count)   : null) : null
                const price_inr = rate_inr != null && count != null ? rate_inr * count : null
                return {
                  name:      r.name.trim(),
                  cut_size:  r.cut_size.trim(),
                  shape:     r.shape.trim(),
                  color:     r.color.trim(),
                  count,
                  rate_inr,
                  price_inr,
                }
              })
              .filter((r) => r.name !== '' || r.cut_size !== '' || r.rate_inr != null)
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
                    ? 'Matrix columns: gold purities (e.g. 18Kt / 14Kt / 9Kt)'
                    : 'Matrix columns: silver purities (925 / 835)',
                )
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
            </select>
            {isEdit && (
              <span className="text-[11px] text-ink-faint">Edit pe metal change nahi — naya product banao agar metal alag ho.</span>
            )}
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Design Number</span>
            <input
              type="number"
              min={1}
              value={productNumber}
              onChange={(e) => setProductNumber(parseInt(e.target.value, 10) || 1)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Design number</span>
            <input
              value={designNumber}
              onChange={(e) => setDesignNumber(e.target.value)}
              placeholder="e.g. AMI-2041"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase"
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

      {/* Diamond specifications section hidden — fields replaced by Stone (gem) section below */}

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
              const rateNum  = parseFloat(row.rate)
              const countNum = parseInt(row.count)
              const price    = Number.isFinite(rateNum) && Number.isFinite(countNum) && countNum > 0
                ? rateNum * countNum
                : null
              const stoneInp = 'w-full border rounded-lg px-3 py-2 text-sm'
              const update = (field: Partial<typeof row>) =>
                setStoneRows((prev) => prev.map((r) => r.key === row.key ? { ...r, ...field } : r))
              return (
                <div key={row.key} className="border border-divider rounded-xl p-4 space-y-3 bg-surface/40">
                  {/* Row header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
                      Stone {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (stoneRows.length <= 1) { setStoneRows([newStoneRow()]); return }
                        setStoneRows((prev) => prev.filter((r) => r.key !== row.key))
                      }}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      aria-label="Remove stone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Row 1: Stone name + Cut/size */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Stone name</span>
                      <input
                        value={row.name}
                        onChange={(e) => update({ name: e.target.value })}
                        className={stoneInp}
                        placeholder="e.g. Ruby"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Cut / size</span>
                      <input
                        value={row.cut_size}
                        onChange={(e) => update({ cut_size: e.target.value })}
                        className={stoneInp}
                        placeholder="e.g. Round 0.5 ct"
                      />
                    </label>
                  </div>

                  {/* Row 2: Shape + Color */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Shape</span>
                      <input
                        value={row.shape}
                        onChange={(e) => update({ shape: e.target.value })}
                        className={stoneInp}
                        placeholder="e.g. Oval"
                      />
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
                  </div>

                  {/* Row 3: Count + Rate + Price */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Count</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.count}
                        onChange={(e) => update({ count: e.target.value })}
                        className={stoneInp}
                        placeholder="0"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Rate (₹)</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.rate}
                        onChange={(e) => update({ rate: e.target.value })}
                        className={stoneInp}
                        placeholder="0"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-ink-muted">Price (₹) = Rate × Count</span>
                      <div className={`${stoneInp} bg-surface text-ink-muted tabular-nums cursor-default select-none`}>
                        {price != null ? `₹${price.toLocaleString('en-IN')}` : '—'}
                      </div>
                    </label>
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
        <p className="text-sm text-ink-muted">
          Price is calculated automatically from today&apos;s gold/silver rate, weight, making charge %, and stone lines.
        </p>
        {!hasMetalPurities ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            `metal_purities` table empty hai. Supabase me seed / migration chalao — gold (18/14/09) aur silver (925/835) columns yahan dikhenge.
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
                        metal_weight_g: '',
                        stock_qty: '1',
                        is_active: true,
                      }
                      return (
                        <td key={purity.id} className="px-2 py-2 border-b align-top min-w-[11rem]">
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            placeholder="Weight (g)"
                            value={cell.metal_weight_g}
                            onChange={(e) =>
                              setCellValue(row.color_id, purity.id, (current) => ({
                                ...current,
                                metal_weight_g: e.target.value,
                              }))
                            }
                            className="w-full border rounded px-2 py-1 mb-2"
                          />
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Stock"
                            value={cell.stock_qty}
                            onChange={(e) => setCellValue(row.color_id, purity.id, (current) => ({ ...current, stock_qty: e.target.value }))}
                            className="w-full border rounded px-2 py-1 mb-2"
                          />
                          <label className="flex items-center gap-2 text-xs text-ink-muted mb-2">
                            <input
                              type="checkbox"
                              checked={cell.is_active}
                              onChange={(e) => setCellValue(row.color_id, purity.id, (current) => ({ ...current, is_active: e.target.checked }))}
                            />
                            Active variant
                          </label>
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
            disabled={saving || justPublished}
            onClick={() => void submit('active')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              justPublished
                ? 'bg-teal/80 text-white cursor-default'
                : 'bg-teal text-white hover:bg-deep-teal'
            }`}
          >
            {publishing && saving ? 'Publishing…' : justPublished ? 'Published' : 'Publish'}
          </button>
        </div>
      </section>
    </div>
  )
}
