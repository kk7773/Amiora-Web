'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload'
import { generateAmioraSKU, slugifyName } from '@/lib/sku'

type Category = { id: string; name: string; code: string | null }
type Collection = { id: string; name: string }
type MetalColor = { id: string; label: string; code: string; hex: string | null; display_order: number }
type MetalPurity = { id: string; label: string; code: string; display_order: number }

type ColorRow = {
  key: string
  id?: string
  color_id: string
  images: string[]
  display_order: number
}

type MatrixSeedCell = {
  id?: string
  color_id: string
  purity_id: string
  price: number
  stock_qty: number
  is_active: boolean
  sku?: string
}

type InitialData = {
  id: string
  product: {
    name: string
    slug: string
    category_id: string
    collection_id: string | null
    product_number: number
    short_desc: string | null
    description: string | null
    diamond_shape: string | null
    diamond_count: number | null
    total_diamond_wt: number | null
    diamond_color: string | null
    diamond_clarity: string | null
    size_range: string | null
    meta_title: string | null
    meta_description: string | null
    status: 'draft' | 'active' | 'archived'
    is_featured: boolean
    is_new_arrival: boolean
    is_best_seller: boolean
    is_coming_soon: boolean
    making_charge_pct: number
  }
  colorVariants: Array<{
    id: string
    color_id: string
    images: string[]
    display_order: number
  }>
  matrix: MatrixSeedCell[]
}

export type ProductCatalogCreateFormProps = {
  categories: Category[]
  collections: Collection[]
  metalColors: MetalColor[]
  metalPurities: MetalPurity[]
  initialData?: InitialData
}

type CellState = {
  id?: string
  price: string
  stock_qty: string
  is_active: boolean
}

function buildCellKey(colorId: string, purityId: string) {
  return `${colorId}:${purityId}`
}

function buildCellState(matrix: MatrixSeedCell[]) {
  return Object.fromEntries(
    matrix.map((cell) => [
      buildCellKey(cell.color_id, cell.purity_id),
      {
        id: cell.id,
        price: String(cell.price),
        stock_qty: String(cell.stock_qty),
        is_active: cell.is_active,
      } satisfies CellState,
    ]),
  ) as Record<string, CellState>
}

export function ProductCatalogCreateForm({
  categories,
  collections,
  metalColors,
  metalPurities,
  initialData,
}: ProductCatalogCreateFormProps) {
  const router = useRouter()
  const { uploading, uploadFiles } = useCloudinaryUpload('amiora/products/colors')

  const isEdit = !!initialData

  const sortedPurities = useMemo(
    () => [...metalPurities].sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)),
    [metalPurities],
  )

  const hasMetalColors = metalColors.length > 0
  const hasMetalPurities = sortedPurities.length > 0

  const [name, setName] = useState(initialData?.product.name ?? '')
  const [slug, setSlug] = useState(initialData?.product.slug ?? '')
  const [slugManual, setSlugManual] = useState(!!initialData?.product.slug)
  const [categoryId, setCategoryId] = useState(initialData?.product.category_id ?? categories[0]?.id ?? '')
  const [collectionId, setCollectionId] = useState<string>(initialData?.product.collection_id ?? '')
  const [productNumber, setProductNumber] = useState(initialData?.product.product_number ?? 1)

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

  const [colorRows, setColorRows] = useState<ColorRow[]>(
    initialData?.colorVariants.map((row) => ({
      key: row.id,
      id: row.id,
      color_id: row.color_id,
      images: row.images,
      display_order: row.display_order,
    })) ?? [],
  )

  const [cells, setCells] = useState<Record<string, CellState>>(buildCellState(initialData?.matrix ?? []))
  const [saving, setSaving] = useState(false)

  const categoryCode = categories.find((c) => c.id === categoryId)?.code ?? 'XX'

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

  useEffect(() => {
    if (isEdit || colorRows.length > 0 || metalColors.length === 0) return
    const defaultRows = metalColors.slice(0, 3).map((color, index) => ({
      key: `seed-${color.id}`,
      color_id: color.id,
      images: [],
      display_order: index,
    }))
    setColorRows(defaultRows)
  }, [isEdit, colorRows.length, metalColors])

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
      for (const purity of sortedPurities) {
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
    const list = await uploadFiles(Array.from(files))
    if (!list.length) return
    setColorRows((prev) =>
      prev.map((row) =>
        row.key === rowKey ? { ...row, images: [...row.images, ...list.map((item) => item.url)] } : row,
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
      const current = prev[key] ?? { price: '', stock_qty: '1', is_active: true }
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
      display_order: index,
    }))

    for (const row of colorVariants) {
      if (row.images.length === 0) {
        toast.error('Each colour needs at least one image')
        return
      }
    }

    const matrix: Array<{
      id?: string
      color_id: string
      purity_id: string
      price: number
      stock_qty: number
      is_active: boolean
    }> = []

    for (const row of colorRows) {
      for (const purity of sortedPurities) {
        const current = cells[buildCellKey(row.color_id, purity.id)]
        if (!current) continue
        const price = parseFloat(current.price.trim())
        if (!Number.isFinite(price) || price <= 0) continue
        matrix.push({
          id: current.id,
          color_id: row.color_id,
          purity_id: purity.id,
          price,
          stock_qty: Math.max(0, Math.floor(Number(current.stock_qty) || 0)),
          is_active: current.is_active,
        })
      }
    }

    if (matrix.length === 0) {
      toast.error('Enter at least one valid variant price')
      return
    }

    setSaving(true)
    try {
      const productPayload = {
        name: name.trim(),
        slug: slug.trim(),
        category_id: categoryId,
        collection_id: collectionId || null,
        product_number: productNumber,
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
      }

      const res = await fetch(isEdit ? `/api/products/${initialData.id}` : '/api/products/catalog', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: productPayload,
          color_variants: colorVariants,
          matrix,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? res.statusText)

      toast.success(nextStatus === 'active' ? 'Product published' : nextStatus === 'archived' ? 'Product archived' : 'Draft saved')
      router.push(body.id ? `/products/${body.id}` : isEdit ? `/products/${initialData.id}` : '/products')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-10 pb-24">
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
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Collection (optional)</span>
            <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">—</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>{collection.name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Product #</span>
            <input
              type="number"
              min={1}
              value={productNumber}
              onChange={(e) => setProductNumber(parseInt(e.target.value, 10) || 1)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
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

      <section className="bg-white rounded-xl border border-divider p-6 space-y-4">
        <h3 className="font-display text-lg text-deep-teal">Diamond specifications</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block space-y-1"><span className="text-xs text-ink-muted">Shape</span>
            <input value={diamondShape} onChange={(e) => setDiamondShape(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="block space-y-1"><span className="text-xs text-ink-muted">Count</span>
            <input type="number" value={diamondCount} onChange={(e) => setDiamondCount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="block space-y-1"><span className="text-xs text-ink-muted">Total wt (ct)</span>
            <input value={totalWt} onChange={(e) => setTotalWt(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="block space-y-1"><span className="text-xs text-ink-muted">Diamond colour</span>
            <input value={diamondColor} onChange={(e) => setDiamondColor(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="block space-y-1"><span className="text-xs text-ink-muted">Clarity</span>
            <input value={diamondClarity} onChange={(e) => setDiamondClarity(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="block space-y-1 sm:col-span-2"><span className="text-xs text-ink-muted">Size / length</span>
            <input value={sizeRange} onChange={(e) => setSizeRange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
        </div>
      </section>

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
          <p className="text-sm text-ink-muted">Add one row per jewellery colour. Har colour row me images upload hongi.</p>
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
                <div>
                  <input type="file" accept="image/*" multiple onChange={(e) => void onPickFiles(row.key, e.target.files)} disabled={uploading} className="text-sm" />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {row.images.map((url, imageIndex) => (
                      <div key={url} className="relative group w-20 h-20 rounded border overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100">
                          <button type="button" className="bg-white/90 text-xs px-1 rounded" onClick={() => reorderImage(row.key, imageIndex, -1)}>↑</button>
                          <button type="button" className="bg-white/90 text-xs px-1 rounded" onClick={() => reorderImage(row.key, imageIndex, 1)}>↓</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-divider p-6 space-y-4 overflow-x-auto">
        <h3 className="font-display text-lg text-deep-teal">Pricing matrix (₹)</h3>
        {!hasMetalPurities ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            `metal_purities` table empty hai. Supabase me seed run karo, phir 18Kt / 14Kt / 9Kt columns yahan show honge.
          </div>
        ) : colorRows.length === 0 ? (
          <p className="text-sm text-ink-muted">Pehle colour rows banao. Har purity column me us colour ka price aur stock set hoga.</p>
        ) : (
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-2 border-b">Colour</th>
                {sortedPurities.map((purity) => (
                  <th key={purity.id} className="text-left px-2 py-2 border-b whitespace-nowrap">{purity.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colorRows.map((row) => {
                const color = metalColors.find((entry) => entry.id === row.color_id)
                return (
                  <tr key={row.key}>
                    <td className="px-2 py-3 border-b align-top font-medium">{color?.label ?? row.color_id}</td>
                    {sortedPurities.map((purity) => {
                      const cell = cells[buildCellKey(row.color_id, purity.id)] ?? { price: '', stock_qty: '1', is_active: true }
                      return (
                        <td key={purity.id} className="px-2 py-2 border-b align-top min-w-[11rem]">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Price"
                            value={cell.price}
                            onChange={(e) => setCellValue(row.color_id, purity.id, (current) => ({ ...current, price: e.target.value }))}
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
            disabled={saving}
            onClick={() => void submit('active')}
            className="px-5 py-2.5 rounded-lg bg-teal text-white text-sm font-medium hover:bg-deep-teal"
          >
            Publish
          </button>
        </div>
      </section>
    </div>
  )
}
