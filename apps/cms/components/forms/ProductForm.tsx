'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Save, Upload, X, ImagePlus, Star, Link as LinkIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload'

// TipTap (ProseMirror) is ~500KB — lazy load so product-list page stays fast
const TipTapEditor = dynamic(
  () => import('@/components/editor/TipTapEditor').then(m => ({ default: m.TipTapEditor })),
  { ssr: false, loading: () => <div className="h-40 rounded-lg border border-divider bg-surface animate-pulse" /> }
)
import { toast } from 'sonner'

// ── Moved OUTSIDE component — fixes focus loss on every keystroke ─────────────
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-divider p-5 space-y-4">
      <h3 className="font-display text-base text-deep-teal border-b border-divider pb-2">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-ink-muted uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-teal bg-white ${props.className ?? ''}`}
    />
  )
}

// ComboSelect — dropdown with "Custom…" fallback text input
// Stores custom values and surfaces them as options in future rows
function ComboSelect({
  value,
  onChange,
  options,
  customOptions = [],
  onAddCustom,
  placeholder = '—',
  className = '',
}: {
  value:          string
  onChange:       (v: string) => void
  options:        string[]
  customOptions?: string[]
  onAddCustom?:  (v: string) => void
  placeholder?:   string
  className?:     string
}) {
  const CUSTOM_SENTINEL = '__custom__'
  const allOptions = useMemo(() => {
    const set = new Set([...options, ...customOptions])
    return Array.from(set)
  }, [options, customOptions])

  // Determine if current value is a custom one
  const isCustom = value && !options.includes(value)
  const [showInput, setShowInput] = useState(isCustom)
  const [draft, setDraft]         = useState(isCustom ? value : '')

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === CUSTOM_SENTINEL) {
      setShowInput(true)
      setDraft('')
      onChange('')
    } else {
      setShowInput(false)
      onChange(e.target.value)
    }
  }

  function commitCustom() {
    const v = draft.trim()
    if (!v) return
    onAddCustom?.(v)
    onChange(v)
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <select
        value={showInput ? CUSTOM_SENTINEL : (value || '')}
        onChange={handleSelect}
        className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-full"
      >
        <option value="">{placeholder}</option>
        {allOptions.map(o => <option key={o} value={o}>{o}</option>)}
        <option value={CUSTOM_SENTINEL}>Custom</option>
      </select>
      {showInput && (
        <div className="flex gap-1">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), commitCustom())}
            placeholder="Type & press Enter"
            className="flex-1 border border-teal rounded px-2 py-1 text-xs outline-none bg-white min-w-0"
            autoFocus
          />
          <button
            type="button"
            onClick={commitCustom}
            className="px-2 py-1 bg-teal text-white text-xs rounded hover:bg-deep-teal"
          >✓</button>
          <button
            type="button"
            onClick={() => { setShowInput(false); setDraft(''); onChange('') }}
            className="px-2 py-1 border border-divider text-xs rounded hover:bg-surface"
          >✕</button>
        </div>
      )}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

const pctOrInherit = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return null
    if (typeof val === 'number' && Number.isNaN(val)) return null
    const n = typeof val === 'number' ? val : parseFloat(String(val))
    if (Number.isNaN(n)) return null
    return n
  },
  z.union([z.number().min(0).max(100), z.null()])
)

/** `valueAsNumber` on empty inputs produces NaN — normalize before z.number() */
function num0to100WithDefault(def: number) {
  return z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return def
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isNaN(n)) return def
      return n
    },
    z.number().min(0).max(100)
  )
}

const variantSchema = z.object({
  id: z.preprocess(
    (v) => (v === '' || v == null || v === undefined ? undefined : v),
    z.string().uuid().optional()
  ),
  metal_type:   z.string().min(1),
  purity:       z.string().optional(),
  gold_variant: z.string().optional(),
  gem_cut:      z.string().optional(),
  weight_grams: z.number().min(0),
  gem_weight_ct:z.number().optional(),
  gem_price_inr:z.number().optional(),
  stock_status: z.string().default('in_stock'),
  making_charge_discount_pct: pctOrInherit.optional().default(null),
  gem_price_discount_pct:     pctOrInherit.optional().default(null),
})

const schema = z.object({
  name:                       z.string().min(1, 'Name required'),
  slug:                       z.string().min(1),
  sku:                        z.string().optional(),
  short_description:          z.string().optional(),
  full_description:           z.string().optional(),
  collection_id:              z.string().optional(),
  category_id:                z.string().optional(),
  tag_ids:                    z.array(z.string()).default([]),
  is_featured:                z.boolean().default(false),
  is_new_arrival:             z.boolean().default(false),
  is_best_seller:             z.boolean().default(false),
  is_coming_soon:             z.boolean().default(false),
  is_active:                  z.boolean().default(true),
  making_charge_pct:          num0to100WithDefault(8),
  making_charge_discount_pct: num0to100WithDefault(0),
  gem_price_discount_pct:     num0to100WithDefault(0),
  meta_title:                 z.string().optional(),
  meta_description:           z.string().optional(),
  variants:                   z.array(variantSchema).default([]),
})
type FormData = z.infer<typeof schema>

interface ImageItem { url: string; is_primary: boolean; hover: boolean }
interface FaqItem  { question: string; answer: string }

interface TagOption {
  id: string; name: string; slug: string; color?: string | null
}
interface CollectionOption {
  id: string; name: string; parent_id?: string | null; menu_type?: string | null
}
interface CategoryOption {
  id: string; name: string; parent_id?: string | null
}

interface Props {
  collections:   CollectionOption[]
  categories:    CategoryOption[]
  tags:          TagOption[]
  defaultValues?: Partial<FormData> & {
    id?:             string
    description?:    string
    product_images?: { url: string; is_primary: boolean }[]
    faqs?:           FaqItem[]
  }
}

const METAL_TYPES    = ['gold', 'silver', 'platinum']
const PURITIES_BY_METAL: Record<string, string[]> = {
  gold:     ['9kt', '18kt', '22kt', '24kt'],
  silver:   ['925', '835'],
  platinum: ['95%', '90%'],
}
const GOLD_VARIANTS  = ['yellow', 'white', 'rose']
const GEM_CUTS       = ['round', 'princess', 'oval', 'marquise', 'pear', 'emerald', 'cushion', 'radiant']
const STOCK_STATUSES = ['in_stock', 'low_stock', 'out_of_stock', 'made_to_order']

export function ProductForm({ collections, categories, tags, defaultValues }: Props) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Fix 2: Initialize images from existing product data ─────────────────
  const [images, setImages] = useState<ImageItem[]>(() =>
    (defaultValues?.product_images ?? []).map(img => ({ ...img, hover: false }))
  )
  const [faqs, setFaqs]         = useState<FaqItem[]>(() => defaultValues?.faqs ?? [])
  const [customPurities, setCustomPurities]     = useState<string[]>([])
  const [customColours,  setCustomColours]       = useState<string[]>([])
  const [customGemCuts,  setCustomGemCuts]       = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [imgUrl, setImgUrl] = useState('')
  const { uploading, uploadFiles } = useCloudinaryUpload('amiora/products')

  // Sync images if defaultValues changes (e.g., after server refetch)
  useEffect(() => {
    if (defaultValues?.product_images?.length) {
      setImages(defaultValues.product_images.map(img => ({ ...img, hover: false })))
    }
  }, [defaultValues?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      making_charge_pct:          8,
      making_charge_discount_pct: 0,
      gem_price_discount_pct:     0,
      is_active:                  true,
      variants:                   [],
      tag_ids:                    [],
      ...defaultValues,
      full_description: defaultValues?.full_description ?? defaultValues?.description ?? '',
    },
  })

  // ── Tag toggle helper ────────────────────────────────────────────────────
  const selectedTagIds = watch('tag_ids') ?? []
  function toggleTag(tagId: string) {
    const current = watch('tag_ids') ?? []
    setValue(
      'tag_ids',
      current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId],
      { shouldDirty: true }
    )
  }

  // ── Nested dropdown helpers ──────────────────────────────────────────────
  // Collections: group as [roots…, children under each root]
  const rootCollections = collections.filter(c => !c.parent_id)
  const childCollections = (parentId: string) => collections.filter(c => c.parent_id === parentId)

  const rootCategories  = categories.filter(c => !c.parent_id)
  const childCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  const { fields: variants, append, remove } = useFieldArray({ control, name: 'variants' })

  function genSlug(v: string) {
    setValue('slug', v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  function addImage() {
    if (!imgUrl.trim()) return
    setImages(imgs => [...imgs, { url: imgUrl.trim(), is_primary: imgs.length === 0, hover: false }])
    setImgUrl('')
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const results = await uploadFiles(files)
    results.forEach(r => {
      setImages(imgs => [...imgs, { url: r.url, is_primary: imgs.length === 0, hover: false }])
      toast.success('Image uploaded!')
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  function addVariant() {
    append({
      metal_type: 'gold',
      weight_grams: 0,
      stock_status: 'in_stock',
      making_charge_discount_pct: null,
      gem_price_discount_pct:     null,
    })
  }

  const onSubmit = useCallback(async (data: FormData) => {
    setSaving(true)
    try {
      const payload  = { ...data, images, faqs, tag_ids: watch('tag_ids') ?? [] }
      const isEdit   = !!defaultValues?.id
      const url      = isEdit ? `/api/products/${defaultValues!.id}` : '/api/products'
      const method   = isEdit ? 'PATCH' : 'POST'
      const res      = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      toast.success(isEdit ? 'Product updated!' : 'Product created!')
      router.push('/products')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [images, defaultValues, router])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">

      {/* ── Section 1: Basic Info ─────────────────────────────────────── */}
      <FormSection title="Basic Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Product Name *" error={errors.name?.message}>
            <Input
              {...register('name')}
              onBlur={e => !watch('slug') && genSlug(e.target.value)}
              placeholder="e.g. Celestial Diamond Ring"
            />
          </Field>
          <Field label="Slug *" error={errors.slug?.message}>
            <Input {...register('slug')} placeholder="celestial-diamond-ring" />
          </Field>
          <Field label="SKU">
            <Input {...register('sku')} placeholder="AMR-001-GLD-18K" />
          </Field>
          <Field label="Making Charge %">
            <Input
              type="number"
              step="0.1"
              {...register('making_charge_pct', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Making Charge Discount %">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="0"
              {...register('making_charge_discount_pct', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Stone / Gem Price Discount %">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="0"
              {...register('gem_price_discount_pct', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Collection">
            <select
              {...register('collection_id')}
              className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-teal bg-white"
            >
              <option value="">— Select Collection —</option>
              {rootCollections.map(root => {
                const kids = childCollections(root.id)
                return kids.length > 0 ? (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name}</option>
                    {kids.map(child => (
                      <option key={child.id} value={child.id}>{'  ↳ '}{child.name}</option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={root.id} value={root.id}>{root.name}</option>
                )
              })}
            </select>
          </Field>
          <Field label="Category">
            <select
              {...register('category_id')}
              className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-teal bg-white"
            >
              <option value="">— Select Category —</option>
              {rootCategories.map(root => {
                const kids = childCategories(root.id)
                return kids.length > 0 ? (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name}</option>
                    {kids.map(child => (
                      <option key={child.id} value={child.id}>{'  ↳ '}{child.name}</option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={root.id} value={root.id}>{root.name}</option>
                )
              })}
            </select>
          </Field>
        </div>
        <Field label="Short Description">
          <textarea
            {...register('short_description')}
            rows={2}
            className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-teal bg-white resize-none"
            placeholder="Brief product tagline…"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" {...register('is_featured')} className="rounded accent-teal" />
            Featured Product
          </label>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" {...register('is_new_arrival')} className="rounded accent-teal" />
            New Arrival
          </label>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" {...register('is_best_seller')} className="rounded accent-teal" />
            Best Seller
          </label>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" {...register('is_coming_soon')} className="rounded accent-teal" />
            Coming Soon
          </label>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" {...register('is_active')} className="rounded accent-teal" />
            Active (visible on storefront)
          </label>
        </div>
      </FormSection>

      {/* ── Section 2: Tags ──────────────────────────────────────────── */}
      <FormSection title="Tags">
        {tags.length === 0 ? (
          <p className="text-sm text-ink-faint">
            No tags yet.{' '}
            <a href="/collections" className="text-teal underline underline-offset-2">
              Create tags in Taxonomy Manager →
            </a>
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-ink-faint">Click to assign / remove tags on this product</p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const active = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                      border-2 transition-all duration-150
                      ${active
                        ? 'text-white shadow-sm scale-105'
                        : 'bg-white text-ink-muted hover:scale-105'
                      }
                    `}
                    style={active
                      ? { backgroundColor: tag.color ?? '#94A3B8', borderColor: tag.color ?? '#94A3B8' }
                      : { borderColor: tag.color ?? '#e2e8f0' }
                    }
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: tag.color ?? '#94a3b8', opacity: active ? 0.6 : 1 }}
                    />
                    {tag.name}
                    {active && (
                      <span className="ml-0.5 opacity-75">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
            {selectedTagIds.length > 0 && (
              <p className="text-xs text-ink-muted">
                {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''} selected
                {' · '}
                <button
                  type="button"
                  onClick={() => setValue('tag_ids', [])}
                  className="text-red-400 hover:text-red-600 underline underline-offset-2"
                >
                  Clear all
                </button>
              </p>
            )}
          </div>
        )}
      </FormSection>

      {/* ── Section 3: Full Description ──────────────────────────────── */}
      <FormSection title="Full Description">
        <TipTapEditor
          value={watch('full_description') ?? ''}
          onChange={v => setValue('full_description', v)}
          placeholder="Describe this piece in detail — materials, craftsmanship, occasion…"
        />
      </FormSection>

      {/* ── Section 3: Images ─────────────────────────────────────────── */}
      <FormSection title="Product Images">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-divider rounded-xl py-6 text-sm text-ink-muted hover:border-teal hover:text-teal transition-colors disabled:opacity-50"
        >
          {uploading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading to Cloudinary…</>
            : <><ImagePlus className="w-4 h-4" /> Click to upload image(s) from device</>}
        </button>

        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 flex items-center gap-2 border border-divider rounded-lg px-3 py-2 bg-white focus-within:border-teal">
            <LinkIcon className="w-3.5 h-3.5 text-ink-faint shrink-0" />
            <input
              value={imgUrl}
              onChange={e => setImgUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImage())}
              placeholder="Or paste an image URL and press Enter…"
              className="flex-1 text-sm text-ink outline-none bg-transparent"
            />
          </div>
          <button
            type="button"
            onClick={addImage}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white rounded-lg text-sm hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" /> Add URL
          </button>
        </div>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4">
            {images.map((img, i) => (
              <div key={`${img.url}-${i}`} className="relative group w-24">
                <div className={`w-24 h-24 rounded-xl overflow-hidden border-2 transition-colors ${img.is_primary ? 'border-teal' : 'border-divider'} bg-surface-2`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="mt-1 text-center">
                  {img.is_primary
                    ? <span className="inline-flex items-center gap-0.5 text-[10px] text-teal font-medium"><Star className="w-2.5 h-2.5 fill-teal" /> Primary</span>
                    : <button
                        type="button"
                        onClick={() => setImages(imgs => imgs.map((im, j) => ({ ...im, is_primary: j === i })))}
                        className="text-[10px] text-ink-faint hover:text-teal underline"
                      >Set primary</button>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
        {images.length === 0 && !uploading && (
          <p className="text-xs text-ink-faint text-center mt-2">No images added yet</p>
        )}
      </FormSection>

      {/* ── Section 4: Variants ──────────────────────────────────────── */}
      <FormSection title="Variants">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface">
                {['Metal','Purity','Colour','Gem Cut','Weight (g)','Gem (ct)','Gem Price','Mk Δ%','Stone Δ%','Stock',''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs text-ink-faint font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {variants.map((v, i) => (
                <tr key={v.id} className="bg-white align-top">
                  <td className="px-2 py-2">
                    <input type="hidden" {...register(`variants.${i}.id`)} />
                    <select
                      {...register(`variants.${i}.metal_type`)}
                      onChange={e => {
                        const metal = e.target.value
                        setValue(`variants.${i}.metal_type`, metal, { shouldDirty: true })
                        setValue(`variants.${i}.purity`, '', { shouldDirty: true })
                        if (metal !== 'gold') {
                          setValue(`variants.${i}.gold_variant`, '', { shouldDirty: true })
                        }
                      }}
                      className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-full"
                    >
                      {METAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 min-w-[90px]">
                    <ComboSelect
                      value={watch(`variants.${i}.purity`) ?? ''}
                      onChange={val => setValue(`variants.${i}.purity`, val, { shouldDirty: true })}
                      options={PURITIES_BY_METAL[watch(`variants.${i}.metal_type`)] ?? []}
                      customOptions={customPurities}
                      onAddCustom={v => setCustomPurities(p => p.includes(v) ? p : [...p, v])}
                      placeholder="Purity"
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[90px]">
                    {watch(`variants.${i}.metal_type`) === 'gold' ? (
                      <ComboSelect
                        value={watch(`variants.${i}.gold_variant`) ?? ''}
                        onChange={val => setValue(`variants.${i}.gold_variant`, val, { shouldDirty: true })}
                        options={GOLD_VARIANTS}
                        customOptions={customColours}
                        onAddCustom={v => setCustomColours(p => p.includes(v) ? p : [...p, v])}
                        placeholder="Colour"
                      />
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 min-w-[90px]">
                    <ComboSelect
                      value={watch(`variants.${i}.gem_cut`) ?? ''}
                      onChange={val => setValue(`variants.${i}.gem_cut`, val, { shouldDirty: true })}
                      options={GEM_CUTS}
                      customOptions={customGemCuts}
                      onAddCustom={v => setCustomGemCuts(p => p.includes(v) ? p : [...p, v])}
                      placeholder="Gem Cut"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.01" {...register(`variants.${i}.weight_grams`, { valueAsNumber: true })} className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-20" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.01" {...register(`variants.${i}.gem_weight_ct`, { valueAsNumber: true })} className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-16" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" {...register(`variants.${i}.gem_price_inr`, { valueAsNumber: true })} className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-24" />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      title="Making charge % off; empty = use product default"
                      placeholder="—"
                      {...register(`variants.${i}.making_charge_discount_pct`, {
                        setValueAs: (v) => {
                          if (v === '' || v == null) return null
                          const n = typeof v === 'number' ? v : parseFloat(String(v))
                          return Number.isNaN(n) ? null : n
                        },
                      })}
                      className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-16"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      title="Stone/gem % off; empty = use product default"
                      placeholder="—"
                      {...register(`variants.${i}.gem_price_discount_pct`, {
                        setValueAs: (v) => {
                          if (v === '' || v == null) return null
                          const n = typeof v === 'number' ? v : parseFloat(String(v))
                          return Number.isNaN(n) ? null : n
                        },
                      })}
                      className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-16"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select {...register(`variants.${i}.stock_status`)} className="border border-divider rounded px-2 py-1 text-xs outline-none focus:border-teal bg-white w-full">
                      {STOCK_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addVariant} className="mt-3 flex items-center gap-1.5 text-sm text-teal hover:text-deep-teal transition-colors">
          <Plus className="w-4 h-4" /> Add Variant
        </button>
      </FormSection>

      {/* ── Section 5: FAQs ──────────────────────────────────────────── */}
      <FormSection title="FAQs (Product Page)">
        <p className="text-xs text-ink-faint -mt-2">Shown as accordion on the product page. Add as many as needed.</p>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-divider rounded-xl p-4 space-y-3 bg-surface/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">FAQ #{i + 1}</span>
                <button
                  type="button"
                  onClick={() => setFaqs(f => f.filter((_, idx) => idx !== i))}
                  className="p-1 text-ink-faint hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-ink-muted uppercase tracking-wider">Question</label>
                <input
                  type="text"
                  value={faq.question}
                  onChange={e => setFaqs(f => f.map((item, idx) => idx === i ? { ...item, question: e.target.value } : item))}
                  placeholder="e.g. What is the purity of this ring?"
                  className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-teal bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-ink-muted uppercase tracking-wider">Answer</label>
                <textarea
                  value={faq.answer}
                  onChange={e => setFaqs(f => f.map((item, idx) => idx === i ? { ...item, answer: e.target.value } : item))}
                  placeholder="e.g. This ring is available in 18K and 22K gold purity."
                  rows={3}
                  className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-teal bg-white resize-none"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFaqs(f => [...f, { question: '', answer: '' }])}
          className="flex items-center gap-1.5 text-sm text-teal hover:text-deep-teal transition-colors"
        >
          <Plus className="w-4 h-4" /> Add FAQ
        </button>
      </FormSection>

      {/* ── Section 6: SEO ───────────────────────────────────────────── */}
      <FormSection title="SEO">
        <div className="space-y-3">
          <Field label="Meta Title">
            <Input {...register('meta_title')} placeholder="e.g. Celestial Diamond Ring — AMIORA Jewellery" />
          </Field>
          <Field label="Meta Description">
            <textarea
              {...register('meta_description')}
              rows={2}
              className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-teal bg-white resize-none"
              placeholder="150-160 character description for search engines…"
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Save Buttons ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal text-white rounded-lg text-sm font-medium hover:bg-deep-teal transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : defaultValues?.id ? 'Update Product' : 'Create Product'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 border border-divider rounded-lg text-sm text-ink-muted hover:bg-surface transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
