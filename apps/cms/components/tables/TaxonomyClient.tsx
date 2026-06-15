'use client'

import { useState, useCallback } from 'react'
import {
  Plus, Edit2, Trash2, Loader2, X, Save, ChevronRight,
  Tag as TagIcon, FolderTree, Menu, AlignJustify, Check, Package,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  TaxonomyProductManager,
  type TaxonomyType,
} from '@/components/taxonomy/TaxonomyProductManager'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Collection {
  id: string; name: string; slug: string
  description?: string; banner_url?: string | null
  parent_id: string | null; menu_type: 'main' | 'secondary'
  is_active: boolean; sort_order: number; created_at: string
}
interface Tag {
  id: string; name: string; slug: string
  color?: string | null; sort_order: number
  is_active: boolean; created_at: string
}
interface Category {
  id: string; name: string; slug: string
  description?: string; image_url?: string | null
  parent_id: string | null
  is_active: boolean; sort_order: number; created_at: string
}

type Tab = 'main' | 'secondary' | 'tags' | 'categories'

// ─────────────────────────────────────────────────────────────────────────────
// Slug helper
// ─────────────────────────────────────────────────────────────────────────────
function toSlug(name: string) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag colour palette
// ─────────────────────────────────────────────────────────────────────────────
const COLOURS = [
  '#10B981','#F59E0B','#EC4899','#6366F1','#3B82F6',
  '#EF4444','#8B5CF6','#F97316','#14B8A6','#94A3B8',
]

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  collections: Collection[]
  tags:        Tag[]
  categories:  Category[]
}

type ManagingState = { type: TaxonomyType; id: string; name: string } | null

export function TaxonomyClient({ collections: initCols, tags: initTags, categories: initCats }: Props) {
  const [tab, setTab]               = useState<Tab>('main')
  const [collections, setCols]      = useState(initCols)
  const [tags,        setTags]      = useState(initTags)
  const [categories,  setCats]      = useState(initCats)
  const [managing, setManaging]     = useState<ManagingState>(null)
  const [colCounts, setColCounts]   = useState<Record<string, number>>({})
  const [catCounts, setCatCounts]   = useState<Record<string, number>>({})
  const [tagCounts, setTagCounts]   = useState<Record<string, number>>({})

  const handleCountChange = useCallback((type: TaxonomyType, id: string, count: number) => {
    if (type === 'collection') setColCounts((prev) => ({ ...prev, [id]: count }))
    else if (type === 'category') setCatCounts((prev) => ({ ...prev, [id]: count }))
    else setTagCounts((prev) => ({ ...prev, [id]: count }))
  }, [])

  const prefetchCount = useCallback(async (type: TaxonomyType, itemId: string) => {
    const known =
      type === 'collection' ? colCounts[itemId]
      : type === 'category' ? catCounts[itemId]
      : tagCounts[itemId]
    if (known !== undefined) return

    const base =
      type === 'collection' ? `/api/taxonomy/collections/${itemId}/products`
      : type === 'category' ? `/api/taxonomy/categories/${itemId}/products`
      : `/api/taxonomy/tags/${itemId}/products`

    try {
      const res = await fetch(`${base}?countOnly=1`)
      if (!res.ok) return
      const j = (await res.json()) as { productCount?: number }
      if (typeof j.productCount === 'number') {
        handleCountChange(type, itemId, j.productCount)
      }
    } catch { /* ignore */ }
  }, [colCounts, catCounts, tagCounts, handleCountChange])

  function openManager(type: TaxonomyType, id: string, name: string) {
    setManaging({ type, id, name })
  }

  const mainCols      = collections.filter(c => c.menu_type === 'main')
  const secondaryCols = collections.filter(c => c.menu_type === 'secondary')

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'main',       label: 'Main Menu',       icon: <Menu className="w-4 h-4" />,        count: mainCols.length },
    { key: 'secondary',  label: 'Secondary Menu',  icon: <AlignJustify className="w-4 h-4" />, count: secondaryCols.length },
    { key: 'tags',       label: 'Tags',             icon: <TagIcon className="w-4 h-4" />,      count: tags.length },
    { key: 'categories', label: 'Categories',       icon: <FolderTree className="w-4 h-4" />,   count: categories.length },
  ]

  return (
    <div className="space-y-5">
      {managing && (
        <TaxonomyProductManager
          type={managing.type}
          id={managing.id}
          name={managing.name}
          open
          onClose={() => setManaging(null)}
          onCountChange={(count) => handleCountChange(managing.type, managing.id, count)}
          categories={managing.type === 'category' ? categories.map((c) => ({ id: c.id, name: c.name })) : undefined}
        />
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-divider w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-deep-teal text-white shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-white'
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-white/20 text-white' : 'bg-surface-2 text-ink-faint'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {(tab === 'main' || tab === 'secondary') && (
        <MenuTab
          menuType={tab}
          collections={tab === 'main' ? mainCols : secondaryCols}
          allCollections={collections}
          productCounts={colCounts}
          onPrefetchCount={(itemId) => void prefetchCount('collection', itemId)}
          onManageProducts={(id, name) => openManager('collection', id, name)}
          onChange={updated => setCols(prev =>
            prev.map(c => c.id === updated.id ? updated : c)
          )}
          onAdd={created => setCols(prev => [...prev, created])}
          onDelete={id => setCols(prev => prev.filter(c => c.id !== id))}
        />
      )}
      {tab === 'tags' && (
        <TagsTab
          tags={tags}
          productCounts={tagCounts}
          onPrefetchCount={(itemId) => void prefetchCount('tag', itemId)}
          onManageProducts={(id, name) => openManager('tag', id, name)}
          onChange={updated => setTags(prev => prev.map(t => t.id === updated.id ? updated : t))}
          onAdd={created => setTags(prev => [...prev, created])}
          onDelete={id => setTags(prev => prev.filter(t => t.id !== id))}
        />
      )}
      {tab === 'categories' && (
        <CategoriesTab
          categories={categories}
          productCounts={catCounts}
          onPrefetchCount={(itemId) => void prefetchCount('category', itemId)}
          onManageProducts={(id, name) => openManager('category', id, name)}
          onChange={updated => setCats(prev => prev.map(c => c.id === updated.id ? updated : c))}
          onAdd={created => setCats(prev => [...prev, created])}
          onDelete={id => setCats(prev => prev.filter(c => c.id !== id))}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU TAB (Main Menu / Secondary Menu)
// ─────────────────────────────────────────────────────────────────────────────
interface MenuTabProps {
  menuType: 'main' | 'secondary'
  collections: Collection[]
  allCollections: Collection[]
  productCounts: Record<string, number>
  onPrefetchCount: (id: string) => void
  onManageProducts: (id: string, name: string) => void
  onChange: (c: Collection) => void
  onAdd:    (c: Collection) => void
  onDelete: (id: string) => void
}

function MenuTab({ menuType, collections, allCollections, productCounts, onPrefetchCount, onManageProducts, onChange, onAdd, onDelete }: MenuTabProps) {
  const [editing, setEditing] = useState<Partial<Collection> | null>(null)
  const [saving,  setSaving]  = useState(false)

  const roots    = collections.filter(c => !c.parent_id)
  const children = (parentId: string) => collections.filter(c => c.parent_id === parentId)

  async function save() {
    if (!editing?.name) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const payload = { ...editing, menu_type: menuType }
      const res = await fetch(
        isNew ? '/api/collections' : `/api/collections/${editing.id}`,
        { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      isNew ? onAdd(data) : onChange(data)
      toast.success(isNew ? 'Collection added' : 'Collection updated')
      setEditing(null)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' })
    if (res.ok) { onDelete(id); toast.success('Deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ is_active: true, sort_order: 0, menu_type: menuType, parent_id: null })}
          className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white rounded-lg text-sm hover:bg-teal transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add to {menuType === 'main' ? 'Main' : 'Secondary'} Menu
        </button>
      </div>

      {roots.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-divider">
          <p className="text-ink-muted text-sm">No collections yet. Add your first one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-divider overflow-hidden divide-y divide-divider">
          {roots.map(root => (
            <div key={root.id}>
              <CollectionRow
                col={root}
                indent={0}
                productCount={productCounts[root.id]}
                onPrefetchCount={() => onPrefetchCount(root.id)}
                onManageProducts={() => onManageProducts(root.id, root.name)}
                onEdit={c => setEditing(c)}
                onDelete={del}
                onAddChild={() => setEditing({ is_active: true, sort_order: 0, menu_type: menuType, parent_id: root.id })}
              />
              {children(root.id).map(child => (
                <CollectionRow
                  key={child.id}
                  col={child}
                  indent={1}
                  productCount={productCounts[child.id]}
                  onPrefetchCount={() => onPrefetchCount(child.id)}
                  onManageProducts={() => onManageProducts(child.id, child.name)}
                  onEdit={c => setEditing(c)}
                  onDelete={del}
                  onAddChild={() => setEditing({ is_active: true, sort_order: 0, menu_type: menuType, parent_id: child.id })}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <CollectionModal
          editing={editing}
          menuType={menuType}
          allCollections={allCollections.filter(c => c.menu_type === menuType)}
          saving={saving}
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CollectionRow({
  col, indent, productCount, onPrefetchCount, onManageProducts, onEdit, onDelete, onAddChild,
}: {
  col: Collection; indent: number; productCount?: number
  onPrefetchCount: () => void
  onManageProducts: () => void
  onEdit: (c: Collection) => void
  onDelete: (id: string, name: string) => void
  onAddChild: () => void
}) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 hover:bg-surface/50 ${indent > 0 ? 'pl-12 bg-surface/30' : ''}`}>
      {indent > 0 && <ChevronRight className="w-3 h-3 text-ink-faint shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-ink">{col.name}</span>
        <span className="ml-2 font-mono text-xs text-ink-faint">/{col.slug}</span>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${col.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-ink-faint'}`}>
        {col.is_active ? 'Active' : 'Inactive'}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onManageProducts}
          onMouseEnter={onPrefetchCount}
          title="Manage products"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-teal hover:bg-teal/10 border border-teal/20"
        >
          <Package className="w-3.5 h-3.5" />
          {productCount ?? '·'}
        </button>
        {indent === 0 && (
          <button onClick={onAddChild} title="Add sub-collection" className="p-1.5 rounded hover:bg-surface text-ink-faint hover:text-teal">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onEdit(col)} className="p-1.5 rounded hover:bg-surface text-ink-muted hover:text-teal">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(col.id, col.name)} className="p-1.5 rounded hover:bg-red-50 text-ink-muted hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function CollectionModal({
  editing, menuType, allCollections, saving, onChange, onSave, onClose,
}: {
  editing: Partial<Collection>
  menuType: 'main' | 'secondary'
  allCollections: Collection[]
  saving: boolean
  onChange: (c: Partial<Collection>) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-deep-teal">
            {editing.id ? 'Edit' : 'New'} Collection
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-ink-muted" /></button>
        </div>

        {/* Name */}
        <Field label="Name *">
          <input
            value={editing.name ?? ''}
            onChange={e => onChange({ ...editing, name: e.target.value, slug: !editing.id ? toSlug(e.target.value) : editing.slug })}
            placeholder="e.g. Rings for Men"
            className="field-input"
          />
        </Field>

        {/* Slug */}
        <Field label="Slug (URL segment)">
          <input
            value={editing.slug ?? ''}
            onChange={e => onChange({ ...editing, slug: toSlug(e.target.value) })}
            placeholder="rings-for-men"
            className="field-input font-mono text-xs"
          />
          {editing.slug && (
            <p className="text-xs text-ink-faint mt-1">URL: /{editing.slug}</p>
          )}
        </Field>

        {/* Parent */}
        <Field label="Parent (optional)">
          <select
            value={editing.parent_id ?? ''}
            onChange={e => onChange({ ...editing, parent_id: e.target.value || null })}
            className="field-input"
          >
            <option value="">— None (top level) —</option>
            {allCollections
              .filter(c => !c.parent_id && c.id !== editing.id)
              .map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea
            value={editing.description ?? ''}
            onChange={e => onChange({ ...editing, description: e.target.value })}
            rows={2}
            className="field-input resize-none"
          />
        </Field>

        {/* Active toggle */}
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={editing.is_active ?? true}
            onChange={e => onChange({ ...editing, is_active: e.target.checked })}
            className="rounded accent-teal"
          />
          Active
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onSave}
            disabled={saving || !editing.name}
            className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white rounded-lg text-sm hover:bg-teal disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-divider rounded-lg text-sm text-ink-muted hover:bg-surface">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAGS TAB
// ─────────────────────────────────────────────────────────────────────────────
interface TagsTabProps {
  tags:     Tag[]
  productCounts: Record<string, number>
  onPrefetchCount: (id: string) => void
  onManageProducts: (id: string, name: string) => void
  onChange: (t: Tag) => void
  onAdd:    (t: Tag) => void
  onDelete: (id: string) => void
}

function TagsTab({ tags, productCounts, onPrefetchCount, onManageProducts, onChange, onAdd, onDelete }: TagsTabProps) {
  const [editing, setEditing] = useState<Partial<Tag> | null>(null)
  const [saving,  setSaving]  = useState(false)

  async function save() {
    if (!editing?.name) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const res = await fetch(
        isNew ? '/api/tags' : `/api/tags/${editing.id}`,
        { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) }
      )
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      isNew ? onAdd(data) : onChange(data)
      toast.success(isNew ? 'Tag created' : 'Tag updated')
      setEditing(null)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete tag "${name}"?`)) return
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    if (res.ok) { onDelete(id); toast.success('Tag deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ is_active: true, sort_order: 0 })}
          className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white rounded-lg text-sm hover:bg-teal transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Tag
        </button>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-divider">
          <TagIcon className="w-8 h-8 text-ink-faint mx-auto mb-2" />
          <p className="text-ink-muted text-sm">No tags yet. Create one to assign to products.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map(tag => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-3 py-2 rounded-full border-2 bg-white shadow-sm"
              style={{ borderColor: tag.color ?? '#e2e8f0' }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: tag.color ?? '#94a3b8' }}
              />
              <span className="text-sm font-medium text-ink">{tag.name}</span>
              <span className="font-mono text-xs text-ink-faint">{tag.slug}</span>
              <button
                onClick={() => onManageProducts(tag.id, tag.name)}
                onMouseEnter={() => onPrefetchCount(tag.id)}
                title="Manage products"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-teal hover:bg-teal/10 border border-teal/20 ml-1"
              >
                <Package className="w-3 h-3" />
                {productCounts[tag.id] ?? '·'}
              </button>
              <div className="flex items-center gap-0.5 ml-1">
                <button onClick={() => setEditing(tag)} className="p-1 rounded hover:bg-surface text-ink-faint hover:text-teal">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => del(tag.id, tag.name)} className="p-1 rounded hover:bg-red-50 text-ink-faint hover:text-red-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-deep-teal">{editing.id ? 'Edit' : 'New'} Tag</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-ink-muted" /></button>
            </div>

            <Field label="Tag Name *">
              <input
                value={editing.name ?? ''}
                onChange={e => setEditing(s => ({ ...s!, name: e.target.value, slug: !s!.id ? toSlug(e.target.value) : s!.slug }))}
                placeholder="e.g. Under ₹10k"
                className="field-input"
              />
            </Field>

            <Field label="Slug">
              <input
                value={editing.slug ?? ''}
                onChange={e => setEditing(s => ({ ...s!, slug: toSlug(e.target.value) }))}
                className="field-input font-mono text-xs"
              />
            </Field>

            <Field label="Color">
              <div className="flex flex-wrap gap-2">
                {COLOURS.map(c => (
                  <button
                    key={c}
                    title={c}
                    onClick={() => setEditing(s => ({ ...s!, color: c }))}
                    className="relative w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: editing.color === c ? '#1e293b' : 'transparent' }}
                  >
                    {editing.color === c && (
                      <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
                {/* Custom hex input */}
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={editing.color ?? '#94A3B8'}
                    onChange={e => setEditing(s => ({ ...s!, color: e.target.value }))}
                    className="w-7 h-7 rounded cursor-pointer border border-divider"
                  />
                </div>
              </div>
              {editing.color && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full" style={{ background: editing.color }} />
                  <span className="text-xs font-mono text-ink-faint">{editing.color}</span>
                </div>
              )}
            </Field>

            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                disabled={saving || !editing.name}
                className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white rounded-lg text-sm hover:bg-teal disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-divider rounded-lg text-sm text-ink-muted hover:bg-surface">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES TAB
// ─────────────────────────────────────────────────────────────────────────────
interface CategoriesTabProps {
  categories: Category[]
  productCounts: Record<string, number>
  onPrefetchCount: (id: string) => void
  onManageProducts: (id: string, name: string) => void
  onChange:   (c: Category) => void
  onAdd:      (c: Category) => void
  onDelete:   (id: string)  => void
}

function CategoriesTab({ categories, productCounts, onPrefetchCount, onManageProducts, onChange, onAdd, onDelete }: CategoriesTabProps) {
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [saving,  setSaving]  = useState(false)

  const roots    = categories.filter(c => !c.parent_id)
  const children = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  async function save() {
    if (!editing?.name) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const res = await fetch(
        isNew ? '/api/categories' : `/api/categories/${editing.id}`,
        { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) }
      )
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      isNew ? onAdd(data) : onChange(data)
      toast.success(isNew ? 'Category created' : 'Category updated')
      setEditing(null)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete category "${name}"?\nSub-categories will be moved to top level.`)) return
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    if (res.ok) { onDelete(id); toast.success('Deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ is_active: true, sort_order: 0, parent_id: null })}
          className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white rounded-lg text-sm hover:bg-teal transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {roots.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-divider">
          <FolderTree className="w-8 h-8 text-ink-faint mx-auto mb-2" />
          <p className="text-ink-muted text-sm">No categories yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-divider overflow-hidden divide-y divide-divider">
          {roots.map(root => (
            <div key={root.id}>
              <CategoryRow
                cat={root}
                indent={0}
                productCount={productCounts[root.id]}
                onPrefetchCount={() => onPrefetchCount(root.id)}
                onManageProducts={() => onManageProducts(root.id, root.name)}
                onEdit={c => setEditing(c)}
                onDelete={del}
                onAddChild={() => setEditing({ is_active: true, sort_order: 0, parent_id: root.id })}
              />
              {children(root.id).map(child => (
                <CategoryRow
                  key={child.id}
                  cat={child}
                  indent={1}
                  productCount={productCounts[child.id]}
                  onPrefetchCount={() => onPrefetchCount(child.id)}
                  onManageProducts={() => onManageProducts(child.id, child.name)}
                  onEdit={c => setEditing(c)}
                  onDelete={del}
                  onAddChild={() => {}}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-deep-teal">{editing.id ? 'Edit' : 'New'} Category</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-ink-muted" /></button>
            </div>

            <Field label="Name *">
              <input
                value={editing.name ?? ''}
                onChange={e => setEditing(s => ({ ...s!, name: e.target.value, slug: !s!.id ? toSlug(e.target.value) : s!.slug }))}
                placeholder="e.g. Gold Jewellery"
                className="field-input"
              />
            </Field>

            <Field label="Slug">
              <input
                value={editing.slug ?? ''}
                onChange={e => setEditing(s => ({ ...s!, slug: toSlug(e.target.value) }))}
                className="field-input font-mono text-xs"
              />
              {editing.slug && <p className="text-xs text-ink-faint mt-1">/{editing.slug}</p>}
            </Field>

            <Field label="Parent Category (optional)">
              <select
                value={editing.parent_id ?? ''}
                onChange={e => setEditing(s => ({ ...s!, parent_id: e.target.value || null }))}
                className="field-input"
              >
                <option value="">— None (root level) —</option>
                {categories
                  .filter(c => !c.parent_id && c.id !== editing.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </Field>

            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={e => setEditing(s => ({ ...s!, is_active: e.target.checked }))}
                className="rounded accent-teal"
              />
              Active
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                disabled={saving || !editing.name}
                className="flex items-center gap-2 px-4 py-2 bg-deep-teal text-white rounded-lg text-sm hover:bg-teal disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-divider rounded-lg text-sm text-ink-muted hover:bg-surface">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  cat, indent, productCount, onPrefetchCount, onManageProducts, onEdit, onDelete, onAddChild,
}: {
  cat: Category; indent: number; productCount?: number
  onPrefetchCount: () => void
  onManageProducts: () => void
  onEdit: (c: Category) => void
  onDelete: (id: string, name: string) => void
  onAddChild: () => void
}) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 hover:bg-surface/50 ${indent > 0 ? 'pl-12 bg-surface/30' : ''}`}>
      {indent > 0 && <ChevronRight className="w-3 h-3 text-ink-faint shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-ink">{cat.name}</span>
        <span className="ml-2 font-mono text-xs text-ink-faint">/{cat.slug}</span>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${cat.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-ink-faint'}`}>
        {cat.is_active ? 'Active' : 'Inactive'}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onManageProducts}
          onMouseEnter={onPrefetchCount}
          title="Manage products"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-teal hover:bg-teal/10 border border-teal/20"
        >
          <Package className="w-3.5 h-3.5" />
          {productCount ?? '·'}
        </button>
        {indent === 0 && (
          <button onClick={onAddChild} title="Add sub-category" className="p-1.5 rounded hover:bg-surface text-ink-faint hover:text-teal">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onEdit(cat)} className="p-1.5 rounded hover:bg-surface text-ink-muted hover:text-teal">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(cat.id, cat.name)} className="p-1.5 rounded hover:bg-red-50 text-ink-muted hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Field wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-ink-muted uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
